import { type GateDependencies, type Resource } from "./security.ts";

/** Configuration is intentionally disabled unless deployment is explicitly approved. */
export function runtime(env: (name: string) => string | undefined, fetcher: typeof fetch = fetch): GateDependencies {
  const base = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  const service = env("SUPABASE_SERVICE_ROLE_KEY");
  const configured = Boolean(base?.startsWith("https://") && anon && service);
  return {
    enabled: configured && env("PREDICTOR_EXTERNAL_ENABLED") === "true",
    fetcher,
    async authenticate(token) {
      const response = await fetcher(`${base}/auth/v1/user`, {
        headers: { apikey: anon!, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000), redirect: "error",
      });
      if (!response.ok) return null;
      const user = await response.json();
      return typeof user.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id) && !user.is_anonymous
        ? user.id : null;
    },
    async reserve(userId: string, resource: Resource) {
      const response = await fetcher(`${base}/rest/v1/rpc/reserve_provider_attempt`, {
        method: "POST", headers: { apikey: service!, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_user: userId, p_resource: resource }),
        signal: AbortSignal.timeout(5000), redirect: "error",
      });
      if (!response.ok) throw new Error("BUDGET_STORE_UNAVAILABLE");
      return await response.json() === true;
    },
  };
}
