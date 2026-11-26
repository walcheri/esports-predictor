import { test } from "node:test";
import assert from "node:assert/strict";
import { secure, type GateDependencies } from "../supabase/functions/_shared/security.ts";
import { requestGroqCompletion } from "../supabase/functions/generate-prediction/groq.ts";
function request(body = "{}", token = "synthetic-token") {
  return new Request("https://local.invalid", { method: "POST", headers: {
    "Content-Type": "application/json", Authorization: `Bearer ${token}`,
  }, body });
}
function setup(overrides: Partial<GateDependencies> = {}) {
  const calls: string[] = [];
  const deps: GateDependencies = { enabled: true, authenticate: async () => "synthetic-user",
    reserve: async () => { calls.push("reserve"); return true; },
    fetcher: async () => { calls.push("provider"); return Response.json({ ok: true }); }, ...overrides };
  const run = secure("groq", async (_body, fetcher) => fetcher("https://api.groq.com/openai/v1/chat/completions"), deps);
  return { run, calls };
}
test("disabled and unauthenticated requests make zero paid calls", async () => {
  for (const override of [{ enabled: false }, { authenticate: async () => null }]) {
    const { run, calls } = setup(override);
    assert.ok([401,503].includes((await run(request())).status)); assert.deepEqual(calls, []);
  }
});
test("malformed/oversized input never reserves or invokes provider", async () => {
  for (const body of ["{", JSON.stringify({ data: "x".repeat(33000) })]) {
    const { run, calls } = setup(); assert.ok([400,413].includes((await run(request(body))).status));
    assert.deepEqual(calls, []);
  }
});
test("exhausted or failed budget store fails closed", async () => {
  for (const reserve of [async () => false, async () => { throw new Error("private details"); }]) {
    const { run, calls } = setup({ reserve }); const r = await run(request());
    assert.ok([429,503].includes(r.status)); assert.deepEqual(calls, []);
    assert.ok(!(await r.text()).includes("private"));
  }
});
test("reservation precedes each attempted fetch", async () => {
  const { run, calls } = setup(); assert.equal((await run(request())).status, 200);
  assert.deepEqual(calls, ["reserve", "provider"]);
});
test("Groq preferred model and account catalog recovery preserved and metered", async () => {
  let reservations=0; const models: string[]=[];
  const run=secure("groq", async (_body, fetcher) => requestGroqCompletion("synthetic", {}, fetcher), {
    enabled:true, authenticate:async()=>"synthetic-user",reserve:async()=>{reservations++;return true;},
    fetcher:async(url,init)=>{
      if(String(url).endsWith("/models")) return Response.json({data:[{id:"llama-3.1-8b-instant",active:true}]});
      models.push(JSON.parse(String(init?.body)).model);
      return models.length===1 ? Response.json({error:{code:"model_not_found"}},{status:404}) : Response.json({});
    },
  });
  assert.equal((await run(request())).status,200); assert.equal(reservations,3);
  assert.deepEqual(models,["llama-3.3-70b-versatile","llama-3.1-8b-instant"]);
});
test("unapproved destination is rejected before reservation",async()=>{
  let calls=0;
  const run=secure("groq",async(_b,f)=>f("https://attacker.invalid"),{
    enabled:true,authenticate:async()=>"user",reserve:async()=>{calls++;return true;},fetcher:fetch,
  });
  assert.equal((await run(request())).status,500); assert.equal(calls,0);
});
