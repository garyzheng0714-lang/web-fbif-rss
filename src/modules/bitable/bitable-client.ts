import { env } from "@/lib/env";
import { fetchJson, HttpError } from "@/lib/http";
import { getTenantAccessToken } from "@/modules/auth/feishu";

interface BitableResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

interface BitableRecord {
  record_id: string;
  fields: Record<string, unknown>;
}

interface BitableListRecordsData {
  has_more: boolean;
  page_token?: string;
  items: BitableRecord[];
  total?: number;
}

interface BitableBatchCreateData {
  records: Array<{ record_id: string }>;
}

interface BitableListTablesData {
  has_more: boolean;
  page_token?: string;
  items: Array<{
    table_id: string;
    name: string;
  }>;
}

function getBitableAppToken(): string {
  if (!env.BITABLE_APP_TOKEN) {
    throw new Error("BITABLE_APP_TOKEN is not configured");
  }
  return env.BITABLE_APP_TOKEN;
}

async function bitableRequest<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number; query?: Record<string, string | undefined> },
): Promise<T> {
  const token = await getTenantAccessToken();
  const url = new URL(`https://open.feishu.cn${path}`);

  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetchJson<BitableResponse<T>>(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
    timeoutMs: init.timeoutMs ?? 15000,
  });

  if (response.code !== 0 || !response.data) {
    throw new HttpError(`Bitable API error: ${response.msg ?? "unknown"}`, 400, response);
  }

  return response.data;
}

export async function listBitableTables() {
  const appToken = getBitableAppToken();
  const data = await bitableRequest<BitableListTablesData>(
    `/open-apis/bitable/v1/apps/${appToken}/tables`,
    {
      method: "GET",
    },
  );
  return data.items;
}

export async function listBitableRecords(
  tableId: string,
  pageToken?: string,
  pageSize = 100,
  fieldNames?: string[],
) {
  const appToken = getBitableAppToken();
  const data = await bitableRequest<BitableListRecordsData>(
    `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: "GET",
      query: {
        page_size: String(pageSize),
        page_token: pageToken,
        field_names: fieldNames?.length ? JSON.stringify(fieldNames) : undefined,
      },
    },
  );
  return data;
}

export async function batchCreateBitableRecords(
  tableId: string,
  records: Array<{ fields: Record<string, unknown>; clientToken?: string }>,
) {
  const appToken = getBitableAppToken();
  const created: string[] = [];

  for (const record of records) {
    const query = record.clientToken ? { client_token: record.clientToken } : undefined;
    const data = await bitableRequest<BitableBatchCreateData>(
      `/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`,
      {
        method: "POST",
        query,
        body: JSON.stringify({
          records: [{ fields: record.fields }],
        }),
      },
    );
    if (data.records[0]?.record_id) {
      created.push(data.records[0].record_id);
    }
  }

  return created;
}

export async function batchUpdateBitableRecords(
  tableId: string,
  records: Array<{ recordId: string; fields: Record<string, unknown> }>,
) {
  const appToken = getBitableAppToken();

  if (records.length === 0) {
    return;
  }

  await bitableRequest<unknown>(`/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_update`, {
    method: "POST",
    body: JSON.stringify({
      records: records.map((item) => ({
        record_id: item.recordId,
        fields: item.fields,
      })),
    }),
  });
}
