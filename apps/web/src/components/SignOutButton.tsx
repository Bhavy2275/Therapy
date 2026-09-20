'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SignOutButtonProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export default function SignOutButton({
  className = 'btn-ghost',
  style,
  children = 'Sign Out',
}: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      // 1. Sign out on client to clear local storage and tokens
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }

    try {
      // 2. Clear server-side HTTP cookies
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // ignore
    }

    // 3. Replace history entry so pressing browser Back will NOT return to authenticated page
    window.location.replace('/login');
  };

  return (
    <form action="/api/auth/logout" method="POST" style={{ margin: 0, display: 'inline-block' }}>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={loading}
        className={className}
        style={style}
      >
        {loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="spinner" style={{ width: 14, height: 14 }} />
            Signing out…
          </span>
        ) : (
          children
        )}
      </button>
    </form>
  );
}
