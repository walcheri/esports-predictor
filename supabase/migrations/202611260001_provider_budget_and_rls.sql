-- REVIEW ONLY: no deployment in this PR. All provider policies start disabled.
CREATE TABLE IF NOT EXISTS public.provider_budget_policy (
 resource text PRIMARY KEY CHECK (resource IN ('groq','pandascore','grid','artemox')),
 enabled boolean NOT NULL DEFAULT false,
 daily_attempts integer NOT NULL DEFAULT 0 CHECK (daily_attempts >= 0),
 minute_attempts integer NOT NULL DEFAULT 0 CHECK (minute_attempts >= 0),
 user_daily_attempts integer NOT NULL DEFAULT 0 CHECK (user_daily_attempts >= 0),
 user_minute_attempts integer NOT NULL DEFAULT 0 CHECK (user_minute_attempts >= 0),
 attempt_micro_usd bigint NOT NULL DEFAULT 0 CHECK (attempt_micro_usd >= 0),
 daily_micro_usd bigint NOT NULL DEFAULT 0 CHECK (daily_micro_usd >= 0)
);
INSERT INTO public.provider_budget_policy(resource) VALUES ('groq'),('pandascore'),('grid'),('artemox') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.provider_attempts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 resource text NOT NULL REFERENCES public.provider_budget_policy(resource),
 user_id uuid NOT NULL,
 attempted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd >= 0)
);
CREATE INDEX IF NOT EXISTS provider_attempts_time ON public.provider_attempts(resource, attempted_at);
ALTER TABLE public.provider_budget_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_budget_policy, public.provider_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_provider_attempt(p_user uuid, p_resource text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 policy public.provider_budget_policy%ROWTYPE;
 t timestamptz; day_start timestamptz; total_day bigint; total_min bigint;
 user_day bigint; user_min bigint; spent numeric;
BEGIN
 IF p_user IS NULL THEN RETURN false; END IF;
 -- One policy row serializes all reservations across workers/users for this provider.
 SELECT * INTO policy FROM public.provider_budget_policy WHERE resource=p_resource FOR UPDATE;
 IF NOT FOUND OR NOT policy.enabled OR policy.attempt_micro_usd <= 0 THEN RETURN false; END IF;
 t := clock_timestamp(); day_start := date_trunc('day', t AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
 SELECT count(*) FILTER (WHERE attempted_at >= day_start),
 count(*) FILTER (WHERE attempted_at >= t - interval '1 minute'),
 count(*) FILTER (WHERE attempted_at >= day_start AND user_id=p_user),
 count(*) FILTER (WHERE attempted_at >= t - interval '1 minute' AND user_id=p_user),
 coalesce(sum(reserved_micro_usd) FILTER (WHERE attempted_at >= day_start),0)
 INTO total_day,total_min,user_day,user_min,spent
 FROM public.provider_attempts WHERE resource=p_resource AND attempted_at >= least(day_start,t-interval '1 minute');
 IF total_day>=policy.daily_attempts OR total_min>=policy.minute_attempts OR
 user_day>=policy.user_daily_attempts OR user_min>=policy.user_minute_attempts OR
 spent+policy.attempt_micro_usd>policy.daily_micro_usd THEN RETURN false; END IF;
 INSERT INTO public.provider_attempts(resource,user_id,attempted_at,reserved_micro_usd)
 VALUES(p_resource,p_user,t,policy.attempt_micro_usd);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reserve_provider_attempt(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_provider_attempt(uuid,text) TO service_role;

-- Preserve the partner's policy correction; idempotent Supabase deployment path.
DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;
ALTER POLICY "Anyone can join waitlist" ON public.premium_waitlist TO anon, authenticated
WITH CHECK (email=btrim(email) AND char_length(email) BETWEEN 3 AND 254
 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 AND (user_id IS NULL OR user_id=(SELECT auth.uid())) AND created_at=now());
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE(username, avatar_url) ON public.profiles TO authenticated;
