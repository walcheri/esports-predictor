-- Review-only stage E migration. Never applied to live Supabase by this task.
REVOKE INSERT ON public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.predictions FROM anon, authenticated;
-- Preserve guest waitlist access without exposing membership through unique errors.
CREATE OR REPLACE FUNCTION public.join_waitlist(p_email text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_email IS NULL OR p_email<>btrim(p_email) OR char_length(p_email) NOT BETWEEN 3 AND 254
 OR p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN
  RAISE EXCEPTION 'INVALID_EMAIL' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.premium_waitlist(email,user_id,created_at)
 VALUES(p_email,(SELECT auth.uid()),now()) ON CONFLICT(email) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.join_waitlist(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_waitlist(text) TO anon,authenticated;
REVOKE INSERT ON public.premium_waitlist FROM anon,authenticated;
REVOKE SELECT ON public.premium_waitlist FROM anon,authenticated;
