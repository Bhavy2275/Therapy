'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * SessionGuard
 * Protects client-rendered and bfcache-restored authenticated pages.
 * If the user signs out in another tab, or hits the browser back button after signing out,
 * bfcache or stale browser memory will be immediately invalidated and replaced with /login.
 */
export default function SessionGuard() {
  useEffect(() => {
    const supabase = createClient();

    const verifySession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace('/login');
        }
      } catch {
        window.location.replace('/login');
      }
    };

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
