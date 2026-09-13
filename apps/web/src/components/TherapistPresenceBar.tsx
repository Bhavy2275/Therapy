'use client';

import { useState, useEffect } from 'react';
import { getMatchingSocket } from '@/lib/socket';

export default function TherapistPresenceBar() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Connect socket on mount to register presence
    getMatchingSocket()
      .then((socket) => {
        if (!mounted) return;
        // If socket connects, keep presence updated
      })
      .catch((err) => {
        if (mounted) {
          console.warn('Socket connection warning in PresenceBar:', err);
        }
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
      const socket = await getMatchingSocket();
      socket.emit(
        'therapist:presence',
        { isAvailable: nextState },
        (response: { success?: boolean; error?: string }) => {
          setLoading(false);
          if (response?.error) {
            setError(response.error);
          } else {
            setIsAvailable(nextState);
          }
        },
      );
    } catch {
      setLoading(false);
      setError('Failed to connect to matching gateway.');
    }
  }

  return (
    <div
      className="glass"
      style={{
        borderRadius: '1rem',
        padding: '1.25rem 1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        border: isAvailable
          ? '1px solid rgba(16, 185, 129, 0.4)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isAvailable
          ? '0 0 25px rgba(16, 185, 129, 0.15)'
          : 'none',
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
              background: isAvailable ? '#10b981' : '#6b7280',
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
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#f9fafb' }}>
              {isAvailable ? 'Instant Session Radar: Online' : 'Instant Session Radar: Offline'}
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: '0.35rem',
                background: isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                color: isAvailable ? '#34d399' : '#9ca3af',
              }}
            >
              {isAvailable ? 'RECEIVING REQUESTS' : 'STANDBY'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af', marginTop: '0.2rem' }}>
            {isAvailable
              ? 'You are visible to clients seeking instant therapy. When a client requests, you will receive an offer alert.'
              : 'Toggle online when you have immediate availability to take 45-min live sessions.'}
          </p>
          {error && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#f87171', marginTop: '0.25rem' }}>
              {error}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleTogglePresence}
        disabled={loading}
        className={isAvailable ? 'btn-ghost' : 'btn-primary'}
        style={{
          padding: '0.65rem 1.4rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          borderColor: isAvailable ? 'rgba(239, 68, 68, 0.3)' : undefined,
          color: isAvailable ? '#f87171' : undefined,
          cursor: loading ? 'wait' : 'pointer',
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
