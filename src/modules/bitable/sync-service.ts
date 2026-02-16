import { SourceType } from "@prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { deterministicUuid } from "@/lib/utils";
import {
  batchCreateBitableRecords,
  batchUpdateBitableRecords,
  listBitableRecords,
  listBitableTables,
} from "@/modules/bitable/bitable-client";
import { splitIntoChunks } from "@/modules/feeds/feed-utils";

export function isBitableItemSyncConfigured(): boolean {
  return Boolean(env.BITABLE_APP_TOKEN && env.BITABLE_ITEM_TABLE_ID);
}

export function isBitableSourceSyncConfigured(): boolean {
  return Boolean(env.BITABLE_APP_TOKEN && env.BITABLE_SOURCE_TABLE_ID && env.SOURCE_SYNC_ENABLED);
}

export async function resolveBitableTablesPreview() {
  if (!env.BITABLE_APP_TOKEN) {
    return [];
  }
  try {
    return await listBitableTables();
  } catch {
    return [];
  }
}

export async function syncUnsyncedItemsToBitable(limit = 100) {
  if (!isBitableItemSyncConfigured()) {
    return {
      skipped: true,
      synced: 0,
      reason: "Bitable item sync not configured",
    };
  }

  const items = await db.feedItem.findMany({
    where: { syncedToBitableAt: null },
    orderBy: [{ createdAt: "asc" }],
    take: limit,
    include: {
      source: {
        select: { name: true },
      },
    },
  });

  if (items.length === 0) {
    return {
      skipped: false,
      synced: 0,
      reason: "No new items",
    };
  }

  const toWrite = items.map((item) => ({
    item,
    fields: {
      [env.BITABLE_ITEM_FIELD_TITLE]: item.title,
      [env.BITABLE_ITEM_FIELD_SUMMARY]: item.summary ?? "",
      [env.BITABLE_ITEM_FIELD_LINK]: {
        text: "查看原文",
        link: item.link,
      },
      [env.BITABLE_ITEM_FIELD_SOURCE]: item.source.name,
      [env.BITABLE_ITEM_FIELD_PUBLISHED_AT]: item.publishedAt?.getTime() ?? item.createdAt.getTime(),
      [env.BITABLE_ITEM_FIELD_HASH]: item.contentHash,
    },
    clientToken: deterministicUuid(`item-sync:${item.id}`),
  }));

  const createdRecordIds: Array<{ itemId: string; recordId: string }> = [];

  for (const chunk of splitIntoChunks(toWrite, 50)) {
    const created = await batchCreateBitableRecords(
      env.BITABLE_ITEM_TABLE_ID as string,
      chunk.map((entry) => ({
        fields: entry.fields,
        clientToken: entry.clientToken,
      })),
    );

    created.forEach((recordId, index) => {
      const item = chunk[index];
      if (item) {
        createdRecordIds.push({
          itemId: item.item.id,
          recordId,
        });
      }
    });
  }

  if (createdRecordIds.length > 0) {
    const now = new Date();
    await Promise.all(
      createdRecordIds.map((entry) =>
        db.feedItem.update({
          where: { id: entry.itemId },
          data: {
            syncedToBitableAt: now,
            bitableRecordId: entry.recordId,
          },
        }),
      ),
    );
  }

  return {
    skipped: false,
    synced: createdRecordIds.length,
    reason: "ok",
  };
}

export async function syncSourcesBidirectional() {
  if (!isBitableSourceSyncConfigured()) {
    return {
      skipped: true,
      pulled: 0,
      pushed: 0,
      reason: "Source sync not configured",
    };
  }

  const sourceTableId = env.BITABLE_SOURCE_TABLE_ID as string;
  const localSources = await db.feedSource.findMany({ orderBy: { createdAt: "asc" } });

  const toCreateRemote = localSources.filter((source) => !source.bitableRecordId);
  let pushed = 0;

  if (toCreateRemote.length > 0) {
    const created = await batchCreateBitableRecords(
      sourceTableId,
      toCreateRemote.map((source) => ({
        fields: {
          [env.BITABLE_SOURCE_FIELD_NAME]: source.name,
          [env.BITABLE_SOURCE_FIELD_URL]: source.url,
          [env.BITABLE_SOURCE_FIELD_CATEGORY]: source.category ?? "",
          [env.BITABLE_SOURCE_FIELD_ENABLED]: source.enabled,
          [env.BITABLE_SOURCE_FIELD_TYPE]: source.type,
          [env.BITABLE_SOURCE_FIELD_INTERVAL]: source.pollIntervalMinutes,
        },
        clientToken: deterministicUuid(`source-create:${source.id}`),
      })),
    );

    pushed = created.length;
    await Promise.all(
      created.map((recordId, index) => {
        const source = toCreateRemote[index];
        if (!source) {
          return Promise.resolve();
        }
        return db.feedSource.update({
          where: { id: source.id },
          data: { bitableRecordId: recordId },
        });
      }),
    );
  }

  const remoteRecords = await fetchAllSourceRecords(sourceTableId);
  let pulled = 0;

  for (const record of remoteRecords) {
    const url = asText(record.fields[env.BITABLE_SOURCE_FIELD_URL]);
    if (!url) {
      continue;
    }

    const name = asText(record.fields[env.BITABLE_SOURCE_FIELD_NAME]) || "未命名信源";
    const category = asText(record.fields[env.BITABLE_SOURCE_FIELD_CATEGORY]);
    const interval = asNumber(record.fields[env.BITABLE_SOURCE_FIELD_INTERVAL], 15);
    const enabled = asBoolean(record.fields[env.BITABLE_SOURCE_FIELD_ENABLED], true);
    const type = resolveSourceType(asText(record.fields[env.BITABLE_SOURCE_FIELD_TYPE]));

    await db.feedSource.upsert({
      where: {
        type_url: {
          type,
          url,
        },
      },
      update: {
        name,
        category,
        pollIntervalMinutes: interval,
        enabled,
        bitableRecordId: record.record_id,
      },
      create: {
        name,
        url,
        type,
        category,
        enabled,
        pollIntervalMinutes: interval,
        tags: [],
        bitableRecordId: record.record_id,
      },
    });
    pulled += 1;
  }

  const updates = await buildRemoteUpdatePayload();
  if (updates.length > 0) {
    await batchUpdateBitableRecords(sourceTableId, updates);
  }

  return {
    skipped: false,
    pulled,
    pushed,
    reason: "ok",
  };
}

async function fetchAllSourceRecords(tableId: string) {
  const items: Array<{ record_id: string; fields: Record<string, unknown> }> = [];
  let pageToken: string | undefined;

  do {
    const page = await listBitableRecords(tableId, pageToken, 100);
    items.push(...page.items);
    pageToken = page.has_more ? page.page_token : undefined;
  } while (pageToken);

  return items;
}

async function buildRemoteUpdatePayload() {
  const sources = await db.feedSource.findMany({
    where: { bitableRecordId: { not: null } },
    select: {
      bitableRecordId: true,
      name: true,
      url: true,
      category: true,
      enabled: true,
      type: true,
      pollIntervalMinutes: true,
    },
  });

  return sources
    .filter((source) => source.bitableRecordId)
    .map((source) => ({
      recordId: source.bitableRecordId as string,
      fields: {
        [env.BITABLE_SOURCE_FIELD_NAME]: source.name,
        [env.BITABLE_SOURCE_FIELD_URL]: source.url,
        [env.BITABLE_SOURCE_FIELD_CATEGORY]: source.category ?? "",
        [env.BITABLE_SOURCE_FIELD_ENABLED]: source.enabled,
        [env.BITABLE_SOURCE_FIELD_TYPE]: source.type,
        [env.BITABLE_SOURCE_FIELD_INTERVAL]: source.pollIntervalMinutes,
      },
    }));
}

function resolveSourceType(value: string): SourceType {
  if (value.toUpperCase() === SourceType.WECHAT_PLACEHOLDER) {
    return SourceType.WECHAT_PLACEHOLDER;
  }
  if (value.includes("公众号") || value.includes("wechat")) {
    return SourceType.WECHAT_PLACEHOLDER;
  }
  return SourceType.RSS;
}

function asText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value && typeof value === "object" && "text" in value) {
    const text = (value as { text?: unknown }).text;
    if (typeof text === "string") {
      return text.trim();
    }
  }
  return "";
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "启用", "是"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", "禁用", "否"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}
