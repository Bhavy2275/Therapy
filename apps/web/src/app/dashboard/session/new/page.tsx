'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getMatchingSocket, disconnectMatchingSocket } from '@/lib/socket';
import type { SessionType, SessionMatchedPayload } from '@therapy/shared-types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  IconBolt,
  IconVideo,
  IconMic,
  IconMessageSquare,
  IconCheck,
  IconClock,
  IconLeaf,
} from '@/components/Icons';

type MatchingStep = 'config' | 'searching' | 'matched' | 'timed_out';

const SESSION_MODALITIES: { type: SessionType; label: string; icon: (selected: boolean) => React.ReactNode; desc: string }[] = [
  {
    type: 'video',
    label: 'Live Video',
    icon: (selected) => <IconVideo size={24} color={selected ? '#3b82f6' : '#64748b'} />,
    desc: 'Face-to-face private video call with an active verified therapist.',
  },
  {
    type: 'voice',
    label: 'Voice Only',
    icon: (selected) => <IconMic size={24} color={selected ? '#3b82f6' : '#64748b'} />,
    desc: 'Audio-only consultation for when you prefer not using your camera.',
  },
  {
    type: 'chat',
    label: 'Real-time Chat',
    icon: (selected) => <IconMessageSquare size={24} color={selected ? '#3b82f6' : '#64748b'} />,
    desc: 'Text messaging with your therapist at your own pace.',
  },
];


const LANGUAGE_CHOICES = ['English', 'Hindi', 'Spanish', 'French', 'Bengali', 'Tamil', 'Telugu', 'Any Language'];

export default function NewInstantSessionPage() {
  const router = useRouter();

  const [step, setStep] = useState<MatchingStep>('config');
  const [sessionType, setSessionType] = useState<SessionType>('video');
  const [language, setLanguage] = useState('English');
  const [topic, setTopic] = useState('');

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [matchedTherapist, setMatchedTherapist] = useState<SessionMatchedPayload | null>(null);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
      }
      disconnectMatchingSocket();
    };
  }, []);

  async function startMatching() {
    setStep('searching');
    setErrorMsg(null);
    setSearchSeconds(0);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSearchSeconds((prev) => {
        if (prev >= 59) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStep('timed_out');
          if (channelRef.current && currentSessionIdRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'session:offer_expired',
              payload: { sessionId: currentSessionIdRef.current },
            });
          }
          return 60;
        }
        return prev + 1;
      });
    }, 1000);

    try {
      // 1. Create session via server API
      const res = await fetch('/api/matching/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: sessionType,
          languagePreference: language,
          topic: topic.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start matching request');
      }

      setSessionId(data.sessionId);
      currentSessionIdRef.current = data.sessionId;

      // 2. Broadcast offer via Supabase Realtime to all online therapists
      const supabase = createClient();
      const channel = supabase.channel('therapy:instant-matching');
      channelRef.current = channel;

      channel
        .on('broadcast', { event: 'session:accepted' }, (msg: { payload: unknown }) => {
          const matched = msg.payload as SessionMatchedPayload;
          if (matched && matched.sessionId === data.sessionId) {
            if (timerRef.current) clearInterval(timerRef.current);
            setMatchedTherapist(matched);
            setStep('matched');
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'session:offer',
              payload: data.offer,
            });
          }
        });

      // 3. Best effort Socket.io broadcast (if socket backend is up)
      try {
        const socket = await getMatchingSocket();
        if (socket && socket.connected) {
          socket.on('session:matched', (matchedData: SessionMatchedPayload) => {
            if (timerRef.current) clearInterval(timerRef.current);
            setMatchedTherapist(matchedData);
            setStep('matched');
          });
          socket.emit('session:request', {
            type: sessionType,
            languagePreference: language,
            topic: topic.trim() || undefined,
          });
        }
      } catch {
        // Socket optional
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating session request';
      setErrorMsg(msg);
      setStep('config');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  async function cancelRequest() {
    if (timerRef.current) clearInterval(timerRef.current);
    const activeId = sessionId || currentSessionIdRef.current;
    if (activeId) {
      // 1. Tell therapists via Supabase Realtime broadcast that offer is expired/cancelled
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'session:offer_expired',
          payload: { sessionId: activeId },
        });
      }

      // 2. Cancel in database
      fetch('/api/matching/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeId }),
      }).catch(() => null);

      // 3. Also cancel via socket if connected
      try {
        const socket = await getMatchingSocket();
        if (socket && socket.connected) {
          socket.emit('session:cancel', { sessionId: activeId });
        }
      } catch {
        // Socket optional
      }
    }
    setStep('config');
    setSessionId(null);
    currentSessionIdRef.current = null;
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', background: '#f8f9fa' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid #e2e8f0',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link href="/dashboard" style={{ color: '#64748b', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 500 }}>
              ← Dashboard
            </Link>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>Instant Matching</span>
          </div>

          <span style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1d4ed8',
            fontSize: '0.75rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontWeight: 600,
          }}>
            <IconBolt size={13} color="#2563eb" />
            <span>Live Matching Network</span>
          </span>
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        {/* Step 1: Configuration Form */}
        {step === 'config' && (
          <div className="fade-in-up">
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>
                Start an <span className="gradient-text">Instant Session</span>
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                Choose how you want to connect. We will immediately broadcast your request to all currently available therapists.
              </p>
            </div>

            {errorMsg && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '0.65rem', padding: '0.85rem 1.25rem', marginBottom: '1.5rem',
                color: '#b91c1c', fontSize: '0.875rem', fontWeight: 500,
              }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Modality Selector */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', color: '#1e293b' }}>
                  1. Choose Connection Modality
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {SESSION_MODALITIES.map((m) => {
                    const isSelected = sessionType === m.type;
                    return (
                      <div
                        key={m.type}
                        onClick={() => setSessionType(m.type)}
                        style={{
                          borderRadius: '0.85rem',
                          padding: '1.25rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <div style={{ marginBottom: '0.75rem' }}>{m.icon(isSelected)}</div>

                        <div style={{ fontWeight: 600, fontSize: '1rem', color: isSelected ? '#1d4ed8' : '#1e293b', marginBottom: '0.25rem' }}>
                          {m.label}
                        </div>
                        <p style={{ color: isSelected ? '#2563eb' : '#64748b', fontSize: '0.8rem', lineHeight: 1.5, margin: 0 }}>{m.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Language Selection */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.85rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  2. Language Preference
                </label>
                <p style={{ color: '#64748b', fontSize: '0.825rem', marginBottom: '1rem' }}>
                  We will prioritize therapists who speak your preferred language fluently.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {LANGUAGE_CHOICES.map((lang) => {
                    const isSelected = language === lang;
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setLanguage(lang)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: '2rem',
                          fontSize: '0.825rem',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #86efac' : '1px solid #e2e8f0',
                          background: isSelected ? '#f0fdf4' : '#f8fafc',
                          color: isSelected ? '#166534' : '#475569',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isSelected ? '✓ ' : ''}{lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Focus notes */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.85rem', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                  3. What would you like to talk about today? (Optional)
                </label>
                <p style={{ color: '#64748b', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
                  Briefly sharing what is on your mind helps the responding therapist prepare.
                </p>
                <textarea
                  className="input"
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Feeling overwhelmed with work deadlines, relationship anxiety, or just need someone to talk through things with..."
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                  }}
                />
              </div>

              {/* CTA */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.75rem 1.5rem' }}>
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={startMatching}
                  className="btn-primary"
                  style={{
                    padding: '0.75rem 2.5rem',
                    fontSize: '1rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <IconBolt size={18} />
                  <span>Find Available Therapist Now</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Radar Search State */}
        {step === 'searching' && (
          <div className="fade-in-up" style={{
            background: '#ffffff',
            borderRadius: '1.5rem',
            padding: '4rem 2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
          }}>
            {/* Animated Radar Ripples */}
            <div style={{
              width: 160,
              height: 160,
              margin: '0 auto 2.5rem',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {/* Outer Ripple 1 */}
              <div
                className="ripple-wave"
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid rgba(59, 130, 246, 0.35)',
                }}
              />
              {/* Outer Ripple 2 */}
              <div
                className="ripple-wave"
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  border: '2px solid rgba(20, 184, 166, 0.35)',
                  animationDelay: '1.2s',
                }}
              />
              {/* Center Radar Icon */}
              <div
                className="radar-circle"
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  color: '#ffffff',
                  boxShadow: '0 0 25px rgba(37, 99, 235, 0.45)',
                  zIndex: 2,
                }}
              >
                {sessionType === 'video' ? (
                  <IconVideo size={36} color="#FFFFFF" />
                ) : sessionType === 'voice' ? (
                  <IconMic size={36} color="#FFFFFF" />
                ) : (
                  <IconMessageSquare size={36} color="#FFFFFF" />
                )}
              </div>
            </div>

            <h2 style={{ fontSize: '1.65rem', fontWeight: 700, marginBottom: '0.5rem', color: '#0f172a' }}>
              Finding available therapists...
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: 440, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
              Broadcasting your request to all currently online therapists. The first to accept will be connected with you.
            </p>

            {/* Live Search Timer */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '0.45rem 1.25rem',
              borderRadius: '2rem',
              fontSize: '0.9rem',
              color: '#1d4ed8',
              marginBottom: '2.5rem',
              fontWeight: 500,
            }}>
              <span className="spinner" style={{ width: 14, height: 14, borderColor: '#bfdbfe', borderTopColor: '#2563eb' }} />
              <span>Time elapsed: <strong style={{ color: '#1e40af' }}>00:{String(searchSeconds).padStart(2, '0')}</strong> / 60s</span>
            </div>

            {/* Calming Prompt */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.85rem',
              padding: '1.25rem 1.5rem',
              maxWidth: 520,
              margin: '0 auto 2.5rem',
              color: '#334155',
              fontSize: '0.875rem',
              lineHeight: 1.6,
            }}>
              <IconLeaf size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: '#10b981' }} />
              <em style={{ color: '#475569', fontStyle: 'italic', fontWeight: 500 }}>
                Take a slow, deep breath in... hold for a moment... and gently exhale. Your comfort and privacy are our highest priority.
              </em>
            </div>

            {/* Cancel Action */}
            <div>
              <button
                type="button"
                onClick={cancelRequest}
                style={{
                  padding: '0.65rem 1.75rem',
                  fontSize: '0.875rem',
                  color: '#dc2626',
                  background: '#ffffff',
                  border: '1px solid #fca5a5',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                }}
              >
                Cancel Request
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Match Found Celebration State */}
        {step === 'matched' && matchedTherapist && (
          <div className="fade-in-up" style={{
            borderRadius: '1.5rem',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            border: '2px solid #10b981',
            background: '#ffffff',
            boxShadow: '0 10px 30px rgba(16, 185, 129, 0.1)',
          }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 1.5rem',
            }}>
              ✨
            </div>

            <h2 style={{ fontSize: '1.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#047857' }}>
              Match Confirmed!
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '2rem' }}>
              You have been paired with a licensed professional.
            </p>

            {/* Therapist Dossier Card */}
            <div style={{
              borderRadius: '1rem',
              padding: '1.75rem',
              maxWidth: 480,
              margin: '0 auto 2.5rem',
              textAlign: 'left',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  color: '#ffffff',
                  fontWeight: 700,
                }}>
                  {matchedTherapist.therapistName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#0f172a' }}>{matchedTherapist.therapistName}</div>
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#047857',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.5rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}>
                    <span>Verified Therapist</span>
                    <IconCheck size={13} color="#059669" />
                  </span>
                </div>
              </div>

              {matchedTherapist.therapistBio && (
                <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '1rem' }}>
                  {matchedTherapist.therapistBio}
                </p>
              )}

              {matchedTherapist.specializations && matchedTherapist.specializations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {matchedTherapist.specializations.map((s) => (
                    <span
                      key={s}
                      style={{
                        background: 'rgba(132, 169, 140, 0.15)',
                        border: '1px solid rgba(132, 169, 140, 0.35)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.35rem',
                        fontSize: '0.725rem',
                        color: '#2d5a3c',
                        fontWeight: 600,
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Room Connection Action */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/sessions`)}
                className="btn-primary"
                style={{ padding: '0.85rem 2.75rem', fontSize: '1rem', fontWeight: 600 }}
              >
                Enter Session Room →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Timed Out State */}
        {step === 'timed_out' && (
          <div className="fade-in-up" style={{
            background: '#ffffff',
            borderRadius: '1.5rem',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <IconClock size={40} color="#3b82f6" />
            </div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>
              All therapists are busy right now
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: 460, margin: '0 auto 2rem', lineHeight: 1.6 }}>
              None of our available therapists were able to accept within 60 seconds. You can try requesting again or book a scheduled session for later.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={startMatching}
                className="btn-primary"
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <IconBolt size={16} />
                <span>Try Matching Again</span>
              </button>
              <Link href="/dashboard" className="btn-ghost" style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}>
                Return to Dashboard
              </Link>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
