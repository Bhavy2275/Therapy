'use client';

import { useState, useEffect } from 'react';
import { getMatchingSocket } from '@/lib/socket';
import { createClient } from '@/lib/supabase/client';

interface TherapistPresenceBarProps {
  initialAvailable?: boolean;
}

export default function TherapistPresenceBar({ initialAvailable = false }: TherapistPresenceBarProps) {
  const [isAvailable, setIsAvailable] = useState(initialAvailable);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync latest is_available_now state from Supabase on mount
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function initPresence() {
      try {
        const userRes = await supabase.auth.getUser();
        const user = userRes.data?.user;
        if (!user || !mounted) return;

        const profileRes = await supabase
          .from('therapist_profiles')
          .select('is_available_now')
          .eq('user_id', user.id)
          .single();

        if (mounted && profileRes.data) {
          setIsAvailable(Boolean(profileRes.data.is_available_now));
        }
      } catch (err) {
        console.warn('Presence sync error:', err);
      }
    }

    initPresence();

    // Best-effort matching socket connection
    getMatchingSocket().catch((err) => {
      console.warn('Socket connection warning in PresenceBar:', err);
    });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleTogglePresence() {
    setLoading(true);
    setError(null);
    const nextState = !isAvailable;

    try {
      // 1. Direct database update in Supabase (primary persistence)
      const supabase = createClient();
      const userRes = await supabase.auth.getUser();
      const user = userRes.data?.user;

      if (user) {
        const { error: dbError } = await supabase
          .from('therapist_profiles')
          .update({ is_available_now: nextState })
          .eq('user_id', user.id);

        if (dbError) {
          throw new Error(dbError.message);
        }
      }

      // 2. Best-effort Socket notification with a 2-second timeout so it never hangs
      try {
        const socketPromise = getMatchingSocket();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 2000),
        );
        const socket = await Promise.race([socketPromise, timeoutPromise]);
        if (socket && socket.connected) {
          socket.emit('therapist:presence', { isAvailable: nextState });
        }
      } catch {
        // Socket gateway might not be active, but DB is successfully updated
      }

      setIsAvailable(nextState);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update presence.';
      setError(msg);
    } finally {
      // Ensure the button never stays stuck in "Updating..."
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        border: isAvailable
          ? '1px solid rgba(16, 185, 129, 0.45)'
          : '1px solid #e2e8f0',
        boxShadow: isAvailable
          ? '0 4px 20px rgba(16, 185, 129, 0.12)'
          : '0 1px 3px rgba(0, 0, 0, 0.05)',
        transition: 'all 0.3s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: isAvailable ? '#10b981' : '#94a3b8',
              boxShadow: isAvailable ? '0 0 10px #10b981' : 'none',
              transition: 'background 0.3s',
            }}
          />
          {isAvailable && (
            <div
              style={{
                position: 'absolute',
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: '2px solid rgba(16, 185, 129, 0.6)',
                animation: 'radarPulse 2s infinite',
              }}
            />
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
              {isAvailable ? 'Instant Session Radar: Online' : 'Instant Session Radar: Offline'}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.2rem 0.55rem',
                borderRadius: '0.35rem',
                background: isAvailable ? 'rgba(16, 185, 129, 0.12)' : '#f1f5f9',
                color: isAvailable ? '#059669' : '#475569',
                border: isAvailable ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid #e2e8f0',
              }}
            >
              {isAvailable ? 'RECEIVING REQUESTS' : 'STANDBY'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
            {isAvailable
              ? 'You are visible to clients seeking immediate help. When a client requests, you will receive an offer alert.'
              : 'Toggle online when you have immediate availability to take 45-min live sessions.'}
          </p>
          {error && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#dc2626', marginTop: '0.25rem' }}>
              {error}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleTogglePresence}
        disabled={loading}
        className={`${isAvailable ? '' : 'btn-primary'} w-full sm:w-auto`}
        style={{
          padding: '0.75rem 1.4rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          borderRadius: '0.75rem',
          cursor: loading ? 'wait' : 'pointer',
          transition: 'all 0.2s ease',
          opacity: loading ? 0.75 : 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...(isAvailable
            ? {
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                color: '#dc2626',
              }
            : {}),
        }}
      >
        {loading
          ? 'Updating...'
          : isAvailable
          ? 'Go Offline'
          : 'Go Available Now'}
      </button>
    </div>
  );
}
