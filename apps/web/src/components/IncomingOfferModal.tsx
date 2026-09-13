'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getMatchingSocket } from '@/lib/socket';
import type { TherapistOfferPayload, SessionMatchedPayload } from '@therapy/shared-types';
import { IconVideo, IconMic, IconMessageSquare, IconBolt } from '@/components/Icons';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function IncomingOfferModal() {
  const router = useRouter();
  const [offer, setOffer] = useState<TherapistOfferPayload | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAccepting, setIsAccepting] = useState(false);
  const [outcome, setOutcome] = useState<{ status: 'won' | 'lost'; message: string } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const passedOfferIdsRef = useRef<Set<string>>(new Set());

  // Restore previously passed/dismissed offers from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('therapist_passed_offers');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          arr.forEach((id) => {
            if (typeof id === 'string') passedOfferIdsRef.current.add(id);
          });
        }
      }
    } catch {
      // sessionStorage unavailable or parsing error
    }
  }, []);

  const markOfferAsPassed = useCallback((sessionId: string) => {
    if (!sessionId) return;
    passedOfferIdsRef.current.add(sessionId);
    try {
      const arr = Array.from(passedOfferIdsRef.current).slice(-50);
      sessionStorage.setItem('therapist_passed_offers', JSON.stringify(arr));
    } catch {
      // ignore
    }
  }, []);

  const clearCurrentOffer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setOffer(null);
    setTimeLeft(30);
    setIsAccepting(false);
    setOutcome(null);
  }, []);

  const triggerChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }, []);

  const onOfferReceived = useCallback((newOffer: TherapistOfferPayload) => {
    if (!newOffer || !newOffer.sessionId) return;
    // Don't show offers that the therapist already passed or that timed out
    if (passedOfferIdsRef.current.has(newOffer.sessionId)) {
      return;
    }
    setOffer(newOffer);
    setOutcome(null);
    setIsAccepting(false);
    triggerChime();

    const expires = new Date(newOffer.expiresAt).getTime();
    const now = Date.now();
    const remaining = Math.max(1, Math.round((expires - now) / 1000));
    setTimeLeft(remaining);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          markOfferAsPassed(newOffer.sessionId);
          setOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [triggerChime, markOfferAsPassed]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    // 1. Supabase Realtime Broadcast (Works serverlessly across all devices on Vercel)
    const channel = supabase.channel('therapy:instant-matching');
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'session:offer' }, (res: { payload: unknown }) => {
        if (!mounted) return;
        const newOffer = res.payload as TherapistOfferPayload;
        if (newOffer?.sessionId && passedOfferIdsRef.current.has(newOffer.sessionId)) return;
        onOfferReceived(newOffer);
      })
      .on('broadcast', { event: 'session:offer_expired' }, (res: { payload: unknown }) => {
        if (!mounted) return;
        const data = res.payload as { sessionId: string };
        if (data?.sessionId) {
          markOfferAsPassed(data.sessionId);
        }
        setOffer((current) => {
          if (current && current.sessionId === data?.sessionId) {
            if (timerRef.current) clearInterval(timerRef.current);
            return null;
          }
          return current;
        });
      })
      .on('broadcast', { event: 'session:accepted' }, (res: { payload: unknown }) => {
        if (!mounted) return;
        const data = res.payload as SessionMatchedPayload;
        if (data?.sessionId) {
          markOfferAsPassed(data.sessionId);
        }
        setOffer((current) => {
          if (current && current.sessionId === data?.sessionId) {
            if (timerRef.current) clearInterval(timerRef.current);
            return null;
          }
          return current;
        });
      })
      .subscribe();

    // 2. Continuous DB Polling (every 2s) to guarantee zero missed offers even if WebSocket reconnects
    async function checkPendingOffer() {
      if (!mounted) return;
      try {
        const passedArr = Array.from(passedOfferIdsRef.current);
        const queryStr = passedArr.length > 0 ? `?exclude=${encodeURIComponent(passedArr.join(','))}` : '';
        const res = await fetch(`/api/matching/pending${queryStr}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;

        if (data.hasOffer && data.offer) {
          if (passedOfferIdsRef.current.has(data.offer.sessionId)) {
            return;
          }
          setOffer((curr) => {
            if (!curr || curr.sessionId !== data.offer.sessionId) {
              onOfferReceived(data.offer);
              return data.offer;
            }
            return curr;
          });
        }
      } catch {
        // Ignore network glitches
      }
    }

    checkPendingOffer();
    const pollInterval = setInterval(checkPendingOffer, 2000);

    // 3. Best-effort Socket.io connection (for local development or backend clusters)
    getMatchingSocket()
      .then((socket) => {
        if (!mounted) return;

        socket.on('session:offer', (newOffer: TherapistOfferPayload) => {
          if (!mounted) return;
          onOfferReceived(newOffer);
        });

        socket.on('session:offer_expired', (data: { sessionId: string }) => {
          if (data?.sessionId) {
            markOfferAsPassed(data.sessionId);
          }
          setOffer((current) => {
            if (current && current.sessionId === data.sessionId) {
              if (timerRef.current) clearInterval(timerRef.current);
              return null;
            }
            return current;
          });
        });

        socket.on('session:accepted', (data: SessionMatchedPayload) => {
          if (!mounted) return;
          if (data?.sessionId) {
            markOfferAsPassed(data.sessionId);
          }
          if (timerRef.current) clearInterval(timerRef.current);
          setOutcome({
            status: 'won',
            message: `Session confirmed with ${data.therapistName || 'Client'}!`,
          });
          setTimeout(() => {
            router.push(`/dashboard/session/${data.sessionId}`);
          }, 1800);
        });
      })
      .catch(() => {
        // Socket offline fallback handled by Supabase Realtime & Polling
      });

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(pollInterval);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [router, onOfferReceived, markOfferAsPassed]);

  async function handleAccept() {
    if (!offer || isAccepting) return;
    setIsAccepting(true);

    try {
      // 1. Claim session via robust server API
      const res = await fetch('/api/matching/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: offer.sessionId }),
      });
      const data = await res.json();

      setIsAccepting(false);

      if (data.won) {
        // Broadcast acceptance to client via Supabase Realtime
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'session:accepted',
            payload: data.sessionMatched,
          });
        }

        // Also notify via socket if connected
        try {
          const socket = await getMatchingSocket();
          if (socket && socket.connected) {
            socket.emit('session:accept', { sessionId: offer.sessionId });
          }
        } catch {
          // Socket optional
        }

        setOutcome({
          status: 'won',
          message: 'Session accepted! Entering session room...',
        });
        setTimeout(() => {
          router.push(`/dashboard/session/${offer.sessionId}`);
        }, 1500);
      } else {
        setOutcome({
          status: 'lost',
          message: data.message || 'Another therapist accepted this session first.',
        });
        setTimeout(() => {
          clearCurrentOffer();
        }, 3000);
      }
    } catch {
      setIsAccepting(false);
      setOutcome({
        status: 'lost',
        message: 'Network error communicating with matching engine.',
      });
      setTimeout(() => {
        clearCurrentOffer();
      }, 2500);
    }
  }

  function handlePass() {
    if (offer?.sessionId) {
      markOfferAsPassed(offer.sessionId);
    }
    clearCurrentOffer();
  }

  if (!offer) return null;

  const modalityIcon =
    offer.type === 'video' ? (
      <IconVideo size={36} color="#FFFFFF" />
    ) : offer.type === 'voice' ? (
      <IconMic size={36} color="#FFFFFF" />
    ) : (
      <IconMessageSquare size={36} color="#FFFFFF" />
    );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="fade-in-up"
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: '1.5rem',
          padding: '2.25rem 2rem',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Ringing pulse animation badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div
            style={{
              position: 'relative',
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              boxShadow: '0 0 25px rgba(37, 99, 235, 0.4)',
            }}
          >
            {modalityIcon}
            <div
              style={{
                position: 'absolute',
                inset: -6,
                borderRadius: '50%',
                border: '2px solid rgba(59, 130, 246, 0.6)',
                animation: 'radarPulse 1.5s infinite',
              }}
            />
          </div>
        </div>

        <h3 style={{ fontSize: '1.45rem', fontWeight: 700, marginBottom: '0.35rem', color: '#0f172a' }}>
          Incoming Instant Session Offer!
        </h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          First verified therapist to accept secures the session.
        </p>

        {/* Client & Session Details Card */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '1rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Client</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>
              {offer.clientName}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Modality</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#2563eb', textTransform: 'capitalize' }}>
              {offer.type} Session
            </span>
          </div>
          {offer.languagePreference && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Language</span>
              <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#0f172a' }}>
                {offer.languagePreference}
              </span>
            </div>
          )}
          {offer.topic && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>
                Primary Concern / Focus:
              </span>
              <span style={{ color: '#334155', fontSize: '0.85rem', fontStyle: 'italic' }}>
                &ldquo;{offer.topic}&rdquo;
              </span>
            </div>
          )}
        </div>

        {/* 30s Countdown Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.35rem' }}>
            <span>Time to respond</span>
            <span style={{ color: timeLeft <= 10 ? '#ef4444' : '#2563eb', fontWeight: 700 }}>
              {timeLeft}s
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: '#e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(timeLeft / 30) * 100}%`,
                background: timeLeft <= 10 ? '#ef4444' : '#2563eb',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>

        {/* Outcome notifications */}
        {outcome && (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: outcome.status === 'won' ? '#ecfdf5' : '#fef2f2',
              color: outcome.status === 'won' ? '#047857' : '#b91c1c',
              border: outcome.status === 'won' ? '1px solid #a7f3d0' : '1px solid #fecaca',
            }}
          >
            {outcome.message}
          </div>
        )}

        {/* Action buttons */}
        {!outcome && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleAccept}
              disabled={isAccepting}
              className="btn-primary"
              style={{
                flex: 2,
                padding: '0.85rem 1rem',
                fontSize: '1rem',
                fontWeight: 700,
                background: '#059669',
                boxShadow: '0 4px 15px rgba(5, 150, 105, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <IconBolt size={18} color="#FFFFFF" />
              {isAccepting ? 'Claiming...' : 'Accept Session'}
            </button>

            <button
              type="button"
              onClick={handlePass}
              className="btn-ghost"
              style={{
                flex: 1,
                padding: '0.85rem 1rem',
                fontSize: '0.9rem',
                border: '1px solid #e2e8f0',
              }}
            >
              Pass
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
