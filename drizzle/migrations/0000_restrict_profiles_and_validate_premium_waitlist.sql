DROP POLICY "Public profiles are viewable" ON public.profiles;

ALTER POLICY "Anyone can join waitlist" ON public.premium_waitlist
TO anon, authenticated
WITH CHECK (
  email = btrim(email)
  AND char_length(email) BETWEEN 3 AND 254
  AND email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  AND (user_id IS NULL OR user_id = (SELECT auth.uid()))
  AND created_at = now()
);