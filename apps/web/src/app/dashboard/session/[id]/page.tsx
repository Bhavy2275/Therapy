'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { SessionType } from '@therapy/shared-types';
import {
  IconVideo,
  IconVideoOff,
  IconMic,
  IconMicOff,
  IconMessageSquare,
  IconAlertCircle,
  IconClipboard,
  IconCross,
  IconShield,
  IconSave,
  IconHeart,
} from '@/components/Icons';



type ConnectionState = 'loading' | 'connecting' | 'connected' | 'error' | 'ended';

interface SessionData {
  id: string;
  type: SessionType;
  status: string;
  livekitRoomName: string | null;
  isTherapist: boolean;
  client?: { fullName: string; id: string } | null;
  therapist?: { fullName: string; id: string } | null;
  startedAt?: string | null;
}

interface RoomCredentials {
  token: string | null;
  livekitUrl: string;
  roomName: string;
  session: SessionData;
  isTherapist: boolean;
}

const SESSION_LIMIT_MINUTES = 45;

export default function LiveSessionRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [state, setState] = useState<ConnectionState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<RoomCredentials | null>(null);

  // Call UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ id: string; sender: string; text: string; ts: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load session credentials on mount
  useEffect(() => {
    if (!sessionId) return;
    loadSessionCredentials();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId]);

  async function loadSessionCredentials() {
    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      if (!token) {
        setError('Authentication required. Please log in.');
        setState('error');
        return;
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/sessions/${sessionId}/livekit-token`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(errBody.message || `Failed to load session (${res.status})`);
      }

      const creds = await res.json() as RoomCredentials;
      setCredentials(creds);
      setState('connecting');

      // Start elapsed timer immediately
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= SESSION_LIMIT_MINUTES * 60) {
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return prev + 1;
        });
      }, 1000);

      // Short delay then mark as connected (LiveKit SDK would normally do this)
      setTimeout(() => setState('connected'), 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to session';
      setError(msg);
      setState('error');
    }
  }

  async function handleEndSession() {
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/sessions/${sessionId}/end`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token || ''}` },
        },
      );
    } catch {
      // best effort
    }

    setSessionEnded(true);
    setShowEndConfirm(false);

    if (credentials?.isTherapist) {
      setShowNotesModal(true);
    } else {
      setShowDonationModal(true);
    }
  }

  async function handleSaveNotes() {
    if (!notes.trim()) {
      setShowNotesModal(false);
      router.push('/dashboard/sessions');
      return;
    }
    setNotesSaving(true);

    try {
      const supabase = createClient();
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;

      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/sessions/${sessionId}/notes`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token || ''}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ notes }),
        },
      );
    } catch {
      // best effort
    }

    setNotesSaving(false);
    setShowNotesModal(false);
    router.push('/dashboard/sessions');
  }

  const sendChatMessage = useCallback(() => {
    if (!chatInput.trim() || !credentials) return;
    const senderName = credentials.isTherapist
      ? credentials.session.therapist?.fullName || 'Therapist'
      : credentials.session.client?.fullName || 'You';
    setChatMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        sender: senderName,
        text: chatInput.trim(),
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  }, [chatInput, credentials]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const remainingMins = Math.max(0, SESSION_LIMIT_MINUTES - Math.floor(elapsed / 60));
  const timeWarning = remainingMins <= 5 && remainingMins > 0;

  const sessionType = credentials?.session.type;
  const isVideo = sessionType === 'video';
  const isVoice = sessionType === 'voice';
  const isChat = sessionType === 'chat';

  const otherPersonName = credentials
    ? credentials.isTherapist
      ? credentials.session.client?.fullName || 'Client'
      : credentials.session.therapist?.fullName || 'Therapist'
    : '...';

  // ─── Loading / Error screens ──────────────────────────────────────────────

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div className="mesh-bg" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <IconShield size={40} color="#3b82f6" />
          </div>
          <p style={{ color: '#64748b' }}>Authenticating session room...</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div className="mesh-bg" />
        <div className="glass fade-in-up" style={{ borderRadius: '1.5rem', padding: '3rem 2.5rem', maxWidth: 460, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <IconAlertCircle size={44} color="#dc2626" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#1e293b' }}>Cannot Join Session</h2>
          <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '0.95rem' }}>{error}</p>
          <Link href="/dashboard/sessions" className="btn-primary" style={{ padding: '0.75rem 2rem' }}>
            ← Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  // ─── Post-Session: Notes Modal ─────────────────────────────────────────────

  if (showNotesModal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '1.5rem' }}>
        <div className="mesh-bg" />
        <div className="glass fade-in-up" style={{ borderRadius: '1.5rem', padding: '2.5rem', maxWidth: 560, width: '100%' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
            <IconClipboard size={22} color="#3b82f6" />
            <span>Session Notes</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Add any clinical observations, next steps, or therapy notes for your records. (Optional)
          </p>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Client expressed anxiety around work performance. Practiced CBT reframing techniques. Recommended journaling daily. Follow-up in 2 weeks."
            style={{
              width: '100%',
              minHeight: 180,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.85rem',
              padding: '1rem',
              color: '#f9fafb',
              fontSize: '0.9rem',
              resize: 'vertical',
              lineHeight: 1.6,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              marginBottom: '1.25rem',
            }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => { setShowNotesModal(false); router.push('/dashboard/sessions'); }}
              className="btn-ghost"
              style={{ padding: '0.65rem 1.25rem' }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSaveNotes}
              className="btn-primary"
              disabled={notesSaving}
              style={{ padding: '0.65rem 1.75rem', fontWeight: 600 }}
            >
              {notesSaving ? 'Saving...' : <><IconSave size={15} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Save Notes</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Post-Session: Donation Modal (client-only) ────────────────────────────

  if (showDonationModal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '1.5rem' }}>
        <div className="mesh-bg" />
        <div className="glass fade-in-up" style={{ borderRadius: '1.5rem', padding: '2.5rem', maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: '0.75rem', color: '#3b82f6' }}><IconHeart size={48} /></div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Session Complete</h2>
          <p style={{ color: '#c9bca3', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            Jarwis Help Me! is free for everyone right now. If this session helped you, consider leaving a voluntary donation to support the platform and help other clients access therapy.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => router.push('/dashboard/sessions')}
              className="btn-ghost"
              style={{ padding: '0.65rem 1.5rem' }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => router.push('/donate')}
              className="btn-primary"
              style={{
                padding: '0.65rem 1.75rem',
                fontWeight: 600,
                background: '#3b82f6',
              }}
            >
              <IconHeart size={15} style={{ marginRight: '0.4rem', verticalAlign: 'middle' }} />Donate to Jarwis Help Me!
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Live Session Room ─────────────────────────────────────────────────────

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#070b16', position: 'relative', overflow: 'hidden' }}>
      <div className="mesh-bg" />

      {/* Top Bar */}
      <div style={{
        position: 'relative', zIndex: 10,
        background: 'rgba(10, 15, 30, 0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: '#fdfbf7' }}>Help Me!</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: state === 'connected' ? '#10b981' : '#f59e0b',
              boxShadow: state === 'connected' ? '0 0 8px #10b981' : 'none',
            }} />
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              {state === 'connecting' ? 'Connecting...' : (
                <>Live with <strong style={{ color: '#f9fafb' }}>{otherPersonName}</strong></>
              )}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            background: timeWarning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${timeWarning ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '0.5rem',
            padding: '0.35rem 0.75rem',
            fontSize: '0.875rem',
          }}>
            <span style={{ color: timeWarning ? '#f87171' : '#9ca3af' }}>⏱</span>
            <span style={{ fontWeight: 700, color: timeWarning ? '#f87171' : '#f9fafb', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(elapsed)}
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>/ {SESSION_LIMIT_MINUTES}m</span>
          </div>

          {/* Modality Badge */}
          <span style={{
            background: 'rgba(58, 91, 239, 0.15)',
            border: '1px solid rgba(58, 91, 239, 0.3)',
            color: '#85a8ff',
            padding: '0.3rem 0.7rem',
            borderRadius: '0.4rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'capitalize',
          }}>
            {sessionType}
          </span>

          {/* Chat Toggle (for non-chat sessions) */}
          {!isChat && (
            <button
              type="button"
              onClick={() => setShowChat((v) => !v)}
              className="btn-ghost"
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.85rem',
                background: showChat ? 'rgba(58, 91, 239, 0.2)' : undefined,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <IconMessageSquare size={15} />
              <span>Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 5 }}>

        {/* Video / Voice / Chat main view */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Primary content area */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>

            {/* Video Mode */}
            {isVideo && (
              <>
                {/* Remote participant (other person) */}
                <div style={{
                  flex: 1, minWidth: 320, maxWidth: 720, aspectRatio: '16/9',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem',
                  position: 'relative',
                }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: '#3b82f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '2rem', color: '#fdfbf7', fontWeight: 700,
                  }}>
                    {otherPersonName.charAt(0)}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                    {state === 'connecting' ? `Waiting for ${otherPersonName}...` : `${otherPersonName}'s Camera`}
                  </div>
                  {state === 'connected' && (
                    <div style={{
                      position: 'absolute', bottom: '1rem', left: '1rem',
                      background: 'rgba(0,0,0,0.5)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                      color: '#f9fafb',
                    }}>
                      {otherPersonName}
                    </div>
                  )}
                </div>

                {/* Self view */}
                <div style={{
                  width: 220, aspectRatio: '4/3',
                  background: isCameraOff ? 'rgba(255, 255, 255, 0.03)' : 'rgba(58, 91, 239, 0.1)',
                  border: `1px solid ${isCameraOff ? 'rgba(255,255,255,0.06)' : 'rgba(58, 91, 239, 0.25)'}`,
                  borderRadius: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  position: 'relative',
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                }}>
                  {isCameraOff ? (
                    <>
                      <IconVideoOff size={32} color="#64748b" />
                      <span>Camera Off</span>
                    </>
                  ) : (
                    <>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: '#3b82f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem', color: '#fdfbf7', fontWeight: 700,
                      }}>
                        Y
                      </div>
                      <span>You (Live)</span>
                    </>
                  )}
                  <div style={{
                    position: 'absolute', bottom: '0.5rem', left: '0.5rem',
                    background: 'rgba(0,0,0,0.5)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '0.3rem',
                    fontSize: '0.7rem',
                    color: '#f9fafb',
                  }}>
                    You
                  </div>
                </div>
              </>
            )}

            {/* Voice Mode */}
            {isVoice && (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 140, height: 140, borderRadius: '50%',
                  background: '#3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  boxShadow: '0 0 35px rgba(59, 130, 246, 0.4)',
                  animation: 'radarPulse 2.5s infinite',
                }}>
                  <IconMic size={56} color="#FFFFFF" />
                </div>

                <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                  Voice Call — {otherPersonName}
                </h2>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
                  {state === 'connecting' ? 'Connecting audio...' : 'Connected · Audio Only'}
                </p>

                {/* Speaking indicators */}
                {state === 'connected' && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '1.5rem' }}>
                    {[...Array(7)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 4,
                          height: 8 + Math.sin(i) * 12,
                          borderRadius: 2,
                          background: isMuted ? '#374151' : `rgba(20, 184, 166, ${0.4 + Math.random() * 0.5})`,
                          animation: `rippleWave ${0.8 + i * 0.1}s ease-in-out infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Chat Mode */}
            {isChat && (
              <div style={{ flex: 1, maxWidth: 700, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <ChatPanel
                  messages={chatMessages}
                  chatInput={chatInput}
                  onInputChange={setChatInput}
                  onSend={sendChatMessage}
                />
              </div>
            )}
          </div>
        </div>

        {/* Side Chat Panel (video/voice sessions) */}
        {!isChat && showChat && (
          <div style={{
            width: 320,
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(10, 15, 30, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}>
            <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 600, fontSize: '0.9rem' }}>
              In-Session Chat
            </div>
            <ChatPanel
              messages={chatMessages}
              chatInput={chatInput}
              onInputChange={setChatInput}
              onSend={sendChatMessage}
            />
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div style={{
        position: 'relative', zIndex: 10,
        background: 'rgba(7, 11, 22, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        flexShrink: 0,
      }}>
        {/* Mute */}
        <ControlButton
          onClick={() => setIsMuted((v) => !v)}
          active={!isMuted}
          icon={isMuted ? <IconMicOff size={22} color="#f87171" /> : <IconMic size={22} color="#FFFFFF" />}
          label={isMuted ? 'Unmute' : 'Mute'}
        />

        {/* Camera (video only) */}
        {isVideo && (
          <ControlButton
            onClick={() => setIsCameraOff((v) => !v)}
            active={!isCameraOff}
            icon={isCameraOff ? <IconVideoOff size={22} color="#f87171" /> : <IconVideo size={22} color="#FFFFFF" />}
            label={isCameraOff ? 'Show Cam' : 'Hide Cam'}
          />
        )}

        {/* End Call */}
        <button
          type="button"
          onClick={() => setShowEndConfirm(true)}
          style={{
            width: 56, height: 56,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.9)',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
            transition: 'transform 0.15s',
          }}
          title="End Session"
        >
          <IconCross size={24} color="#FFFFFF" style={{ transform: 'rotate(45deg)' }} />
        </button>
      </div>

      {/* End Confirm Modal */}
      {showEndConfirm && !sessionEnded && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
        }}>
          <div className="glass fade-in-up" style={{ borderRadius: '1.5rem', padding: '2.5rem', maxWidth: 440, width: '100%', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <IconCross size={36} color="#ef4444" style={{ transform: 'rotate(45deg)' }} />
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>End session now?</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
              The session will be marked as completed and {credentials?.isTherapist ? 'you can add your clinical notes.' : 'we will ask about your experience.'}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowEndConfirm(false)}
                className="btn-ghost"
                style={{ padding: '0.65rem 1.5rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEndSession}
                className="btn-primary"
                style={{
                  padding: '0.65rem 1.75rem', fontWeight: 600,
                  background: '#ef4444',
                }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-minute warning banner */}
      {timeWarning && state === 'connected' && (
        <div style={{
          position: 'fixed', top: '4.5rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 100,
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '0.75rem',
          padding: '0.6rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          fontSize: '0.875rem', color: '#f87171', fontWeight: 600,
        }}>
          <IconAlertCircle size={18} color="#f87171" />
          <span>{remainingMins} minute{remainingMins !== 1 ? 's' : ''} remaining in this session</span>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ControlButton({
  onClick, active, icon, label,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        width: 52, height: 52,
        borderRadius: '50%',
        background: active ? 'rgba(255, 255, 255, 0.08)' : 'rgba(239, 68, 68, 0.15)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.12)' : 'rgba(239, 68, 68, 0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {icon}
    </button>
  );
}

function ChatPanel({
  messages, chatInput, onInputChange, onSend,
}: {
  messages: { id: string; sender: string; text: string; ts: string }[];
  chatInput: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
      {/* Messages list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem', marginTop: '2rem' }}>
            <p>Send your first message to begin the chat session.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {msg.sender} · {msg.ts}
            </span>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.75rem 0.75rem 0.75rem 0.2rem',
              padding: '0.6rem 0.9rem',
              fontSize: '0.9rem',
              color: '#f9fafb',
              maxWidth: '85%',
              lineHeight: 1.5,
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '0.85rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        gap: '0.5rem',
      }}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSend()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.65rem',
            padding: '0.55rem 0.9rem',
            color: '#f9fafb',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!chatInput.trim()}
          className="btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          →
        </button>
      </div>
    </div>
  );
}
