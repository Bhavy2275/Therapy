'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMatchingSocket, disconnectMatchingSocket } from '@/lib/socket';
import type { SessionType, SessionMatchedPayload } from '@therapy/shared-types';
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      disconnectMatchingSocket();
    };
  }, []);

  async function startMatching() {
    setStep('searching');
    setErrorMsg(null);
    setSearchSeconds(0);

    timerRef.current = setInterval(() => {
      setSearchSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const socket = await getMatchingSocket();

      // Setup event listeners
      socket.off('session:matched');
      socket.off('session:timed_out');
      socket.off('session:cancelled');

      socket.on('session:matched', (data: SessionMatchedPayload) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setMatchedTherapist(data);
        setStep('matched');
      });

      socket.on('session:timed_out', () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setStep('timed_out');
      });

      socket.on('session:cancelled', () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setStep('config');
      });

      // Emit request to gateway
      socket.emit(
        'session:request',
        {
          type: sessionType,
          languagePreference: language,
          topic: topic.trim() || undefined,
        },
        (res: { success?: boolean; sessionId?: string; error?: string }) => {
          if (res?.error) {
            setErrorMsg(res.error);
            setStep('config');
            if (timerRef.current) clearInterval(timerRef.current);
          } else if (res?.sessionId) {
            setSessionId(res.sessionId);
          }
        },
      );
    } catch {
      setErrorMsg('Could not connect to matching gateway. Please try again.');
      setStep('config');
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  async function cancelRequest() {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const socket = await getMatchingSocket();
      if (sessionId) {
        socket.emit('session:cancel', { sessionId });
      }
    } catch {
      // socket disconnect fallback
    }
    setStep('config');
    setSessionId(null);
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <div className="mesh-bg" />

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(10, 15, 30, 0.8)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href="/dashboard" style={{ color: '#9ca3af', fontSize: '0.875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              ← Dashboard
            </Link>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Instant Matching</span>
          </div>

          <span style={{
            background: 'rgba(58, 91, 239, 0.15)',
            border: '1px solid rgba(58, 91, 239, 0.3)',
            color: '#93c5fd',
            fontSize: '0.75rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}>
            <IconBolt size={13} />
            <span>Live Matching Network</span>
          </span>

        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
        {/* Step 1: Configuration Form */}
        {step === 'config' && (
          <div className="fade-in-up">
            <div style={{ marginBottom: '2rem' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Start an <span className="gradient-text">Instant Session</span>
              </h1>
              <p style={{ color: '#9ca3af', fontSize: '0.95rem' }}>
                Choose how you want to connect. We will immediately broadcast your request to all currently available therapists.
              </p>
            </div>

            {errorMsg && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.65rem', padding: '0.85rem 1.25rem', marginBottom: '1.5rem',
                color: '#f87171', fontSize: '0.875rem',
              }}>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {/* Modality Selector */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                  1. Choose Connection Modality
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {SESSION_MODALITIES.map((m) => {
                    const isSelected = sessionType === m.type;
                    return (
                      <div
                        key={m.type}
                        onClick={() => setSessionType(m.type)}
                        className="glass"
                        style={{
                          borderRadius: '0.85rem',
                          padding: '1.25rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: isSelected ? '2px solid #3a5bef' : '1px solid rgba(255,255,255,0.08)',
                          background: isSelected ? 'rgba(58, 91, 239, 0.15)' : 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ marginBottom: '0.75rem' }}>{m.icon(isSelected)}</div>

                        <div style={{ fontWeight: 600, fontSize: '1rem', color: isSelected ? '#93c5fd' : '#f9fafb', marginBottom: '0.25rem' }}>
                          {m.label}
                        </div>
                        <p style={{ color: '#6b7280', fontSize: '0.8rem', lineHeight: 1.5 }}>{m.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Language Selection */}
              <div className="glass" style={{ borderRadius: '0.85rem', padding: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                  2. Language Preference
                </label>
                <p style={{ color: '#6b7280', fontSize: '0.825rem', marginBottom: '1rem' }}>
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
                          fontWeight: 500,
                          cursor: 'pointer',
                          border: isSelected ? '1px solid #14b8a6' : '1px solid rgba(255,255,255,0.1)',
                          background: isSelected ? 'rgba(20, 184, 166, 0.2)' : 'rgba(255,255,255,0.03)',
                          color: isSelected ? '#5eead4' : '#9ca3af',
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
              <div className="glass" style={{ borderRadius: '0.85rem', padding: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                  3. What would you like to talk about today? (Optional)
                </label>
                <p style={{ color: '#6b7280', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
                  Briefly sharing what is on your mind helps the responding therapist prepare.
                </p>
                <textarea
                  className="input"
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Feeling overwhelmed with work deadlines, relationship anxiety, or just need someone to talk through things with..."
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
          <div className="glass fade-in-up" style={{
            borderRadius: '1.5rem',
            padding: '4rem 2rem',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
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
                  border: '2px solid rgba(58, 91, 239, 0.4)',
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
                  border: '2px solid rgba(45, 212, 191, 0.4)',
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
                  background: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  color: '#fdfbf7',
                  boxShadow: '0 0 25px rgba(59, 130, 246, 0.5)',
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

            <h2 style={{ fontSize: '1.65rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Finding available therapists...
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem', maxWidth: 440, margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
              Broadcasting your request to all currently online therapists. The first to accept will be connected with you.
            </p>

            {/* Live Search Timer */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '0.4rem 1.25rem',
              borderRadius: '2rem',
              fontSize: '0.9rem',
              color: '#93c5fd',
              marginBottom: '2.5rem',
            }}>
              <span className="spinner" style={{ width: 14, height: 14 }} />
              <span>Time elapsed: <strong>00:{String(searchSeconds).padStart(2, '0')}</strong> / 60s</span>
            </div>

            {/* Calming Prompt */}
            <div style={{
              background: 'rgba(58, 91, 239, 0.08)',
              border: '1px solid rgba(58, 91, 239, 0.2)',
              borderRadius: '0.85rem',
              padding: '1.25rem',
              maxWidth: 500,
              margin: '0 auto 2.5rem',
              color: '#d1d5db',
              fontSize: '0.85rem',
              lineHeight: 1.6,
            }}>
              <IconLeaf size={14} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: '#6ee7b7' }} /><em>Take a slow, deep breath in... hold for a moment... and gently exhale. Your comfort and privacy are our highest priority.</em>
            </div>

            {/* Cancel Action */}
            <button
              type="button"
              onClick={cancelRequest}
              className="btn-ghost"
              style={{
                padding: '0.65rem 1.75rem',
                fontSize: '0.875rem',
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              Cancel Request
            </button>
          </div>
        )}

        {/* Step 3: Match Found Celebration State */}
        {step === 'matched' && matchedTherapist && (
          <div className="glass fade-in-up" style={{
            borderRadius: '1.5rem',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            border: '2px solid rgba(16, 185, 129, 0.4)',
            background: 'rgba(16, 185, 129, 0.06)',
          }}>
            <div style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 1.5rem',
            }}>
              ✨
            </div>

            <h2 style={{ fontSize: '1.85rem', fontWeight: 700, marginBottom: '0.35rem', color: '#34d399' }}>
              Match Confirmed!
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem', marginBottom: '2rem' }}>
              You have been paired with a licensed professional.
            </p>

            {/* Therapist Dossier Card */}
            <div className="glass" style={{
              borderRadius: '1rem',
              padding: '1.75rem',
              maxWidth: 480,
              margin: '0 auto 2.5rem',
              textAlign: 'left',
              border: '1px solid rgba(255,255,255,0.12)',
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
                  color: '#fdfbf7',
                  fontWeight: 700,
                }}>
                  {matchedTherapist.therapistName.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.15rem' }}>{matchedTherapist.therapistName}</div>
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
          <div className="glass fade-in-up" style={{
            borderRadius: '1.5rem',
            padding: '3.5rem 2rem',
            textAlign: 'center',
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
