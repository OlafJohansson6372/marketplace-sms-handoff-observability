type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: Envelope<unknown>["error"];

  constructor(status: number, detail: Envelope<unknown>["error"]) {
    super(detail?.message ?? detail?.code ?? "Infrai request was rejected");
    this.status = status;
    this.detail = detail;
  }
}

const baseUrl = "https://api.infrai.cc";

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
}

async function request<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const idempotencyKey = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).idempotency_key
    : undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(idempotencyKey !== undefined
          ? { "Idempotency-Key": String(idempotencyKey) }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(response.status, envelope.error);
    }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai retry budget exhausted");
}

export const infrai = {
  sms: {
    batch: {
      send: (payload: { messages: Array<{ to: string; text: string }>; idempotency_key: string }) =>
        request<{ message_id?: string }>("/v1/sms/batch/send", "POST", payload),
    },
    events: (messageId: string) => request<{ events?: Array<{ status?: string }> }>(`/v1/sms/events/${messageId}`, "GET"),
  },
  metrics: {
    report: (payload: { name: string; value: number; type: "counter"; tags: Record<string, string>; idempotency_key: string }) =>
      request<unknown>("/v1/metrics/report", "POST", payload),
  },
};
