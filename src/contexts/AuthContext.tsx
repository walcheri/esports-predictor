import { AuthContext, type Profile } from "./auth-state";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const generation = useRef(0);
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Profile fetch failed");
        return null;
      }
      return data as Profile | null;
    } catch (err) {
      console.error("Profile fetch failed");
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const current = generation.current;
      const profileData = await fetchProfile(user.id);
      if (generation.current === current) setProfile(profileData);
    }
  };

  // Check if email is confirmed
  const isEmailConfirmed = user?.email_confirmed_at != null;

  useEffect(() => {
    let active = true;
    let observed = false;
    const apply = (next: Session | null) => {
      if (!active) return;
      const current = ++generation.current;
      setSession(next);
      setUser(next?.user ?? null);
      setProfile(null);
      setLoading(false);
      if (next?.user)
        setTimeout(() => {
          if (!active || current !== generation.current) return;
          fetchProfile(next.user.id).then((value) => {
            if (active && current === generation.current) setProfile(value);
          });
        }, 0);
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      observed = true;
      apply(next);
    });
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!observed) apply(session);
      })
      .catch(() => {
        if (!observed) apply(null);
      });
    const invalidate = () => {
      generation.current++;
    };
    return () => {
      active = false;
      invalidate();
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    generation.current++;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const resendConfirmationEmail = async () => {
    if (!user?.email) {
      return { error: new Error("No email found") };
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isEmailConfirmed,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        resendConfirmationEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
