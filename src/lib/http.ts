export class HttpError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.payload = payload;
  }
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 10000);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = text ? safeParseJson(text) : null;

    if (!response.ok) {
      throw new HttpError(`Request failed with status ${response.status}`, response.status, parsed ?? text);
    }

    return parsed as T;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new HttpError("Request timeout", 408);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
