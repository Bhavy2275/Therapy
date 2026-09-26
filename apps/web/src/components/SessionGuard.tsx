'use client';

import { useEffect } from 'react';
import { createClient, resetClient } from '@/lib/supabase/client';

/**
 * SessionGuard
 * Protects client-rendered and bfcache-restored authenticated pages.
 *
 * Uses getUser() (which makes a server round-trip to validate the JWT)
 * instead of getSession() (which only reads from local storage and can
 * be fooled by a stale/tampered JWT after logout).
 *
 * If the user signs out in another tab, or hits the browser back button
 * after signing out, bfcache or stale browser memory will be immediately
 * invalidated and replaced with /login.
 */
export default function SessionGuard() {
  useEffect(() => {
    const supabase = createClient();

    const verifySession = async () => {
      try {
        // getUser() validates the JWT against Supabase's server — cannot be
        // bypassed by a stale client-side session unlike getSession().
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          resetClient();
          window.location.replace('/login');
        }
      } catch {
        resetClient();
        window.location.replace('/login');
      }
    };

    // Run immediately on mount to catch stale bfcache pages
    verifySession();

    // 1. Detect Back-Forward Cache (bfcache) restoration on back/forward browser button
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        verifySession();
      }
    };

    window.addEventListener('pageshow', handlePageShow);

    // 2. React to auth state changes (e.g. sign-out in current or another tab)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (event === 'SIGNED_OUT' || !session) {
        resetClient();
        window.location.replace('/login');
      }
    });

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
