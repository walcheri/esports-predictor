-- Create premium waitlist table
CREATE TABLE public.premium_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE public.premium_waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for non-logged users too)
CREATE POLICY "Anyone can join waitlist"
ON public.premium_waitlist
FOR INSERT
WITH CHECK (true);

-- Users can view their own waitlist entry
CREATE POLICY "Users can view their own entry"
ON public.premium_waitlist
FOR SELECT
USING (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));