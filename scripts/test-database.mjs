// Disposable PostgreSQL only. Never points at a configured Supabase project.
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname) || !new URL(url).pathname.endsWith("/predictor_test")) {
  throw new Error("Explicit localhost predictor_test database required");
}
const sql = postgres(url, { max: 20, onnotice: () => {} });
try {
  await sql.unsafe(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;`);
  for (const path of [
    "supabase/migrations/20251203100439_ebb090be-8c65-468e-b5b3-28a8b391c72c.sql",
    "supabase/migrations/20251206132636_9af88ced-d223-4a91-97f2-b3b352ae3cd6.sql",
  ]) await sql.unsafe(await readFile(path,"utf8"));
  await sql.unsafe("GRANT SELECT,INSERT,UPDATE,DELETE ON public.profiles,public.predictions,public.premium_waitlist TO anon,authenticated");
  const migration = await readFile("supabase/migrations/202611260001_provider_budget_and_rls.sql","utf8");
  await sql.unsafe(migration); await sql.unsafe(migration); // idempotent
  const stageE=await readFile("supabase/migrations/202611270001_stage_e_history_and_waitlist.sql","utf8");
  await sql.unsafe(stageE);await sql.unsafe(stageE);
  const a="00000000-0000-4000-8000-000000000001", b="00000000-0000-4000-8000-000000000002";
  await sql`INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES (${a},'a@example.invalid','{}'),(${b},'b@example.invalid','{}')`;
  const asUser = (user, action) => sql.begin(async tx => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`SELECT set_config('request.jwt.claim.sub',${user},true)`;
    return action(tx);
  });
  assert.equal((await asUser(a, tx => tx`SELECT id FROM public.profiles`)).length,1);
  await assert.rejects(asUser(a, tx => tx`INSERT INTO public.predictions(user_id,match_id,team_a,team_b,game) VALUES (${a},'fake','A','B','cs2')`));
  await assert.rejects(asUser(a, tx => tx`UPDATE public.profiles SET predictions_count=999 WHERE id=${a}`));
  await assert.rejects(asUser(a, tx => tx`SELECT public.reserve_provider_attempt(${a},'groq')`));
  await assert.rejects(asUser(a, tx => tx`INSERT INTO public.premium_waitlist(email,user_id) VALUES ('a@example.invalid',${b})`));
  await sql.begin(async tx => { await tx.unsafe("SET LOCAL ROLE anon");
    await tx`SELECT public.join_waitlist('guest@example.invalid')`;await tx`SELECT public.join_waitlist('guest@example.invalid')`; });
  await assert.rejects(asUser(a,tx=>tx`SELECT public.join_waitlist('invalid')`),{code:'22023'});
  await asUser(a,tx=>tx`UPDATE public.profiles SET username='safe-user' WHERE id=${a}`);
  await assert.rejects(asUser(a,tx=>tx`INSERT INTO public.profiles(id,predictions_count) VALUES (${a},999)`),{code:'42501'});
  await sql`INSERT INTO public.predictions(user_id,match_id,team_a,team_b,game) VALUES (${a},'legacy-a','A','B','cs2'),(${b},'legacy-b','C','D','cs2')`;
  assert.equal((await asUser(a,tx=>tx`SELECT * FROM public.predictions`)).length,1);
  await assert.rejects(asUser(a,tx=>tx`SELECT * FROM public.premium_waitlist`),{code:'42501'});
  await sql`UPDATE public.provider_budget_policy SET enabled=true,daily_attempts=5,minute_attempts=5,
    user_daily_attempts=5,user_minute_attempts=5,attempt_micro_usd=10,daily_micro_usd=50 WHERE resource='groq'`;
  const results = await Promise.all(Array.from({length:40},(_,i)=>sql.begin(async tx=>{
    await tx.unsafe("SET LOCAL ROLE service_role");
    return tx`SELECT public.reserve_provider_attempt(${i%2?a:b},'groq') AS allowed`;
  })));
  assert.equal(results.filter(r=>r[0].allowed).length,5);
  assert.equal(Number((await sql`SELECT sum(reserved_micro_usd) AS total FROM public.provider_attempts`)[0].total),50);
  console.log("PASS: migration replay, RLS isolation, guest/forged waitlist, protected counters, 40 concurrent reservations capped at 5/50 units");
} finally { await sql.end(); }
