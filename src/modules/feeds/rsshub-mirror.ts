import { env } from "@/lib/env";

const DEFAULT_RSSHUB_MIRRORS = [
  "https://rsshub.umzzz.com",
  "https://rsshub.rssforever.com",
  "https://hub.slarker.me",
  "https://rsshub.pseudoyu.com",
  "https://rsshub.ktachibana.party",
  "https://rsshub.isrss.com",
  "https://rss.datuan.dev",
  "https://rsshub.cups.moe",
  "https://rss.spriple.org",
];

const OFFLINE_RSSHUB_HOSTS = new Set(["rsshub.app"]);
const PROBE_PATHS = ["/healthz", "/"];

export interface RsshubMirrorProbeResult {
  origin: string;
  host: string;
  online: boolean;
  latencyMs: number | null;
  statusCode: number | null;
  checkedAt: string;
  errorMessage?: string;
}

export function parseRsshubMirrorOrigins(rawMirrors = env.RSSHUB_MIRRORS): string[] {
  const configured = splitMirrorInputs(rawMirrors).map(toOrigin).filter(Boolean) as string[];
  const defaults = DEFAULT_RSSHUB_MIRRORS.map(toOrigin).filter(Boolean) as string[];
  const pool = configured.length > 0 ? configured : defaults;
  return unique(pool);
}

export function normalizeMirrorOriginInput(input: string): string | null {
  return toOrigin(input.trim());
}

export function isRsshubSourceUrl(rawUrl: string, mirrorOrigins = parseRsshubMirrorOrigins()): boolean {
  const parsed = safeParseUrl(rawUrl.trim());
  if (!parsed) {
    return false;
  }
  const hosts = buildKnownHosts(mirrorOrigins);
  return isLikelyRsshubHost(parsed.hostname.toLowerCase(), hosts);
}

export function rewriteRsshubSourceToMirror(
  rawUrl: string,
  targetOrigin: string,
  mirrorOrigins = parseRsshubMirrorOrigins(),
): string {
  const parsed = safeParseUrl(rawUrl.trim());
  if (!parsed) {
    return rawUrl.trim();
  }

  const hosts = buildKnownHosts(mirrorOrigins);
  if (!isLikelyRsshubHost(parsed.hostname.toLowerCase(), hosts)) {
    return parsed.toString();
  }

  const origin = normalizeMirrorOriginInput(targetOrigin);
  if (!origin) {
    throw new Error("Invalid mirror origin");
  }

  return buildMirrorUrl(parsed, origin);
}

export function normalizeRsshubSourceUrl(rawUrl: string, mirrorOrigins = parseRsshubMirrorOrigins()): string {
  const normalized = rawUrl.trim();
  const parsed = safeParseUrl(normalized);
  if (!parsed) {
    return normalized;
  }

  const hosts = buildKnownHosts(mirrorOrigins);
  if (!isLikelyRsshubHost(parsed.hostname.toLowerCase(), hosts)) {
    return parsed.toString();
  }

  if (!OFFLINE_RSSHUB_HOSTS.has(parsed.hostname.toLowerCase())) {
    return parsed.toString();
  }

  if (mirrorOrigins.length === 0) {
    return parsed.toString();
  }

  return buildMirrorUrl(parsed, mirrorOrigins[0] as string);
}

export function buildRsshubCandidateUrls(rawUrl: string, mirrorOrigins = parseRsshubMirrorOrigins()): string[] {
  const normalized = rawUrl.trim();
  const parsed = safeParseUrl(normalized);
  if (!parsed) {
    return [normalized];
  }

  const hosts = buildKnownHosts(mirrorOrigins);
  const host = parsed.hostname.toLowerCase();
  if (!isLikelyRsshubHost(host, hosts)) {
    return [parsed.toString()];
  }

  const result: string[] = [];
  if (!OFFLINE_RSSHUB_HOSTS.has(host)) {
    result.push(parsed.toString());
  }

  mirrorOrigins.forEach((origin) => {
    result.push(buildMirrorUrl(parsed, origin));
  });

  const deduped = unique(result);
  return deduped.length > 0 ? deduped : [parsed.toString()];
}

export async function probeRsshubMirrors(
  mirrorOrigins = parseRsshubMirrorOrigins(),
  timeoutMs = env.RSS_FETCH_TIMEOUT_MS,
): Promise<RsshubMirrorProbeResult[]> {
  return Promise.all(mirrorOrigins.map((origin) => probeRsshubMirror(origin, timeoutMs)));
}

export async function probeRsshubMirror(
  mirrorOrigin: string,
  timeoutMs = env.RSS_FETCH_TIMEOUT_MS,
): Promise<RsshubMirrorProbeResult> {
  const checkedAt = new Date().toISOString();
  const origin = normalizeMirrorOriginInput(mirrorOrigin);
  if (!origin) {
    return {
      origin: mirrorOrigin,
      host: mirrorOrigin,
      online: false,
      latencyMs: null,
      statusCode: null,
      checkedAt,
      errorMessage: "invalid mirror origin",
    };
  }

  const host = new URL(origin).host;
  let lastErrorMessage: string | undefined;
  let lastStatus: number | null = null;

  for (const path of PROBE_PATHS) {
    const url = new URL(path, origin).toString();
    const started = Date.now();

    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      const latency = Date.now() - started;
      lastStatus = response.status;

      if (response.status < 500) {
        return {
          origin,
          host,
          online: true,
          latencyMs: latency,
          statusCode: response.status,
          checkedAt,
        };
      }
      lastErrorMessage = `status ${response.status}`;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "request failed";
    }
  }

  return {
    origin,
    host,
    online: false,
    latencyMs: null,
    statusCode: lastStatus,
    checkedAt,
    errorMessage: lastErrorMessage ?? "unreachable",
  };
}

function splitMirrorInputs(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toOrigin(value: string): string | null {
  const normalized = /^(https?):\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function buildKnownHosts(mirrorOrigins: readonly string[]): Set<string> {
  const hosts = new Set<string>();
  mirrorOrigins.forEach((origin) => {
    try {
      hosts.add(new URL(origin).hostname.toLowerCase());
    } catch {
      // ignore invalid origins
    }
  });

  OFFLINE_RSSHUB_HOSTS.forEach((host) => hosts.add(host));
  return hosts;
}

function isLikelyRsshubHost(host: string, knownHosts: ReadonlySet<string>): boolean {
  if (knownHosts.has(host)) {
    return true;
  }
  return host.includes("rsshub");
}

function buildMirrorUrl(sourceUrl: URL, mirrorOrigin: string): string {
  const target = new URL(mirrorOrigin);
  target.pathname = sourceUrl.pathname;
  target.search = sourceUrl.search;
  target.hash = sourceUrl.hash;
  return target.toString();
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}
