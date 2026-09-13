'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getMatchingSocket } from '@/lib/socket';
import type { TherapistOfferPayload, SessionMatchedPayload } from '@therapy/shared-types';
import { IconVideo, IconMic, IconMessageSquare, IconBolt } from '@/components/Icons';


export default function IncomingOfferModal() {
  const router = useRouter();
  const [offer, setOffer] = useState<TherapistOfferPayload | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isAccepting, setIsAccepting] = useState(false);
  const [outcome, setOutcome] = useState<{ status: 'won' | 'lost'; message: string } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    let mounted = true;

    getMatchingSocket()
      .then((socket) => {
        if (!mounted) return;

        // Listen for new session offer broadcast
        socket.on('session:offer', (newOffer: TherapistOfferPayload) => {
          if (!mounted) return;
          setOffer(newOffer);
          setOutcome(null);
          setIsAccepting(false);

          // Calculate remaining seconds
          const expires = new Date(newOffer.expiresAt).getTime();
          const now = Date.now();
          const remaining = Math.max(1, Math.round((expires - now) / 1000));
          setTimeLeft(remaining);

          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                if (timerRef.current) clearInterval(timerRef.current);
                setOffer(null);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        });

        // Listen for offer expired / taken by another therapist
        socket.on('session:offer_expired', (data: { sessionId: string }) => {
          setOffer((current) => {
            if (current && current.sessionId === data.sessionId) {
              if (timerRef.current) clearInterval(timerRef.current);
              return null;
            }
            return current;
          });
        });

        // Listen for winning confirmation
        socket.on('session:accepted', (data: SessionMatchedPayload) => {
          if (!mounted) return;
          if (timerRef.current) clearInterval(timerRef.current);
          setOutcome({
            status: 'won',
            message: `Session confirmed with ${data.therapistName || 'Client'}!`,
          });
          setTimeout(() => {
            router.push('/dashboard/sessions');
          }, 2000);
        });
      })
      .catch((err) => {
        console.warn('Socket connection error in IncomingOfferModal:', err);
      });

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router]);

  async function handleAccept() {
    if (!offer || isAccepting) return;
    setIsAccepting(true);

    try {
      const socket = await getMatchingSocket();
      socket.emit(
        'session:accept',
        { sessionId: offer.sessionId },
        (res: { success?: boolean; sessionMatched?: SessionMatchedPayload; message?: string }) => {
          setIsAccepting(false);
          if (res?.success) {
            setOutcome({
              status: 'won',
              message: 'Session accepted! Preparing your session room...',
            });
            setTimeout(() => {
              router.push('/dashboard/sessions');
            }, 1800);
          } else {
            // Lost race
            setOutcome({
              status: 'lost',
              message: res?.message || 'Another therapist accepted this session first.',
            });
            setTimeout(() => {
              clearCurrentOffer();
            }, 3000);
          }
        },
      );
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
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        className="glass fade-in-up"
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: '1.5rem',
          padding: '2rem',
          border: '1px solid rgba(58, 91, 239, 0.4)',
          boxShadow: '0 0 50px rgba(58, 91, 239, 0.3)',
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
              background: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)',
            }}
          >
            {modalityIcon}
            <div
              style={{
                position: 'absolute',
                inset: -6,
                borderRadius: '50%',
                border: '2px solid rgba(96, 165, 250, 0.7)',
                animation: 'radarPulse 1.5s infinite',
              }}
            />
          </div>
        </div>

        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem', color: '#fdfbf7' }}>
          Incoming Instant Session Offer!
        </h3>
        <p style={{ color: '#c9bca3', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          First verified therapist to accept secures the session.
        </p>

        {/* Client & Session Details Card */}
        <div
          style={{
            background: 'rgba(253, 251, 247, 0.04)',
            border: '1px solid rgba(253, 251, 247, 0.09)',
            borderRadius: '1rem',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ color: '#c9bca3', fontSize: '0.85rem' }}>Client</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fdfbf7' }}>
              {offer.clientName}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span style={{ color: '#c9bca3', fontSize: '0.85rem' }}>Modality</span>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#60a5fa', textTransform: 'capitalize' }}>
              {offer.type} Session
            </span>
          </div>
          {offer.languagePreference && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ color: '#c9bca3', fontSize: '0.85rem' }}>Language</span>
              <span style={{ fontWeight: 500, fontSize: '0.85rem', color: '#fdfbf7' }}>
                {offer.languagePreference}
              </span>
            </div>
          )}
          {offer.topic && (
            <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: '#c9bca3', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>
                Primary Concern / Focus:
              </span>
              <span style={{ color: '#ede7d9', fontSize: '0.85rem', fontStyle: 'italic' }}>
                &ldquo;{offer.topic}&rdquo;
              </span>
            </div>
          )}
        </div>

        {/* 30s Countdown Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#c9bca3', marginBottom: '0.35rem' }}>
            <span>Time to respond</span>
            <span style={{ color: timeLeft <= 10 ? '#f87171' : '#60a5fa', fontWeight: 700 }}>
              {timeLeft}s
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: 'rgba(253, 251, 247, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(timeLeft / 30) * 100}%`,
                background: timeLeft <= 10 ? '#ef4444' : '#3b82f6',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>

        {/* Outcome notifications */}
        {outcome && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: outcome.status === 'won' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: outcome.status === 'won' ? '#34d399' : '#f87171',
              border: outcome.status === 'won' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
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
                background: '#10b981',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
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
