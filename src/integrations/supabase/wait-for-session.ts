import type { Session } from "@supabase/supabase-js";
import { supabase } from "./client";

let cached: Promise<Session | null> | null = null;

export function waitForInitialSession(timeoutMs = 1500): Promise<Session | null> {
  if (cached) return cached;
  cached = new Promise<Session | null>((resolve) => {
    let done = false;
    const finish = (s: Session | null) => {
      if (done) return;
      done = true;
      try {
        sub.data.subscription.unsubscribe();
      } catch {}
      resolve(s);
    };

    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (session || event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        finish(session ?? null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(data.session);
    });

    setTimeout(() => finish(null), timeoutMs);
  });
  return cached;
}
