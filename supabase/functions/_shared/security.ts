/** Injected dependencies make every security path testable without a live service. */
export class GateError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export type Resource = "groq" | "pandascore" | "grid" | "artemox";
export type GateDependencies = {
  enabled: boolean;
  authenticate: (token: string) => Promise<string | null>;
  reserve: (userId: string, resource: Resource) => Promise<boolean>;
  fetcher: typeof fetch;
};
const hosts: Record<Resource, string> = {
  groq: "api.groq.com", pandascore: "api.pandascore.co",
  grid: "api.grid.gg", artemox: "api.artemox.com",
};
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...cors, "Cache-Control": "no-store" } });
}
export async function readJson(req: Request, maximum = 32768): Promise<unknown> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    throw new GateError(415, "JSON_REQUIRED");
  }
  const reader = req.body?.getReader();
  if (!reader) throw new GateError(400, "BODY_REQUIRED");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximum) { await reader.cancel(); throw new GateError(413, "BODY_TOO_LARGE"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new GateError(400, "INVALID_JSON"); }
}
export type SecuredHandler = (body: unknown, paidFetch: typeof fetch, userId: string) => Promise<Response>;
export function secure(resource: Resource, handler: SecuredHandler, deps: GateDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
    try {
      if (!deps.enabled) throw new GateError(503, "EXTERNAL_DATA_DISABLED");
      const header = req.headers.get("authorization") ?? "";
      if (!/^Bearer \S{10,8192}$/.test(header)) throw new GateError(401, "AUTH_REQUIRED");
      const userId = await deps.authenticate(header.slice(7));
      if (!userId) throw new GateError(401, "AUTH_INVALID");
      const body = await readJson(req);
      const paidFetch: typeof fetch = async (input, init) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.protocol !== "https:" || url.hostname !== hosts[resource] || url.port || url.username || url.password) {
          throw new GateError(500, "PROVIDER_DESTINATION_REJECTED");
        }
        // Never refund uncertain attempts; this also charges recovery/catalog calls.
        if (!await deps.reserve(userId, resource)) throw new GateError(429, "BUDGET_EXHAUSTED");
        return deps.fetcher(input, {
          ...init, redirect: "error",
          signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
        });
      };
      return await handler(body, paidFetch, userId);
    } catch (error) {
      return error instanceof GateError ? json({ error: error.code }, error.status)
        : json({ error: "UPSTREAM_OR_GATE_UNAVAILABLE" }, 503);
    }
  };
}
