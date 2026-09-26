'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * AuthRecoveryListener
 *
 * Listens for password recovery tokens and events globally across all pages.
 * If a user clicks a Supabase recovery link that drops them at the root (/)
 * or anywhere with #access_token=...&type=recovery or fires PASSWORD_RECOVERY,
 * this listener immediately navigates them to /reset-password.
 */
export default function AuthRecoveryListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;

    // 1. Check if the URL hash contains type=recovery
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      if (pathname !== '/reset-password') {
        window.location.replace('/reset-password' + hash);
        return;
      }
    }

    // 2. Check if query parameters contain type=recovery or error
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('type') === 'recovery') {
      if (pathname !== '/reset-password') {
        window.location.replace('/reset-password' + window.location.search);
        return;
      }
    }

    // 3. Listen for Supabase PASSWORD_RECOVERY auth state event
    try {
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event: string) => {
        if (event === 'PASSWORD_RECOVERY') {
          if (window.location.pathname !== '/reset-password') {
            window.location.replace('/reset-password');
          }
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch {
      // client initialization error safety
    }
  }, []);

  return null;
}
