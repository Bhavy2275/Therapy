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
  IconSend,
} from '@/components/Icons';

type ConnectionState = 'loading' | 'connecting' | 'connected' | 'error' | 'ended';

interface SessionData {
  id: string;
  type: SessionType;
  status: string;
  livekitRoomName: string | null;
  isTherapist: boolean;
  client?: { fullName: string; id: string; email?: string } | null;
  therapist?: { fullName: string; id: string; email?: string } | null;
  startedAt?: string | null;
}

interface RoomCredentials {
  token: string | null;
  livekitUrl: string;
  roomName: string;
  session: SessionData;
  isTherapist: boolean;
  userId: string;
}

interface ChatMessage {
  id: string;
  senderId: string;
  sender: string;
  text: string;
  ts: string;
  isSelf?: boolean;
}

const SESSION_LIMIT_MINUTES = 45;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export default function LiveSessionRoomPage() {
  const { id: sessionId } = useParams<{ id: string }>();
  const router = useRouter();

  const [state, setState] = useState<ConnectionState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<RoomCredentials | null>(null);

  // Call UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [notes, setNotes] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnected, setPeerConnected] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  // WebRTC refs
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const isSubscribedRef = useRef(false);
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const currentUserIdRef = useRef<string>('');

  // ── Sync video elements when streams become available ─────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {
        // Autoplay may need user gesture
      });
    }
  }, [remoteStream]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanupAll();
  }, [cleanupAll]);

  // ── WebRTC Signaling Helpers ─────────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (stream: MediaStream | null, isInitiator: boolean, channel: any, myUserId: string) => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Add local tracks if any
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

      // Handle incoming remote tracks
      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote track:', event.track.kind);
        const [incomingStream] = event.streams;
        if (incomingStream) {
          setRemoteStream(incomingStream);
          setPeerConnected(true);
        } else {
          const newStream = new MediaStream([event.track]);
          setRemoteStream(newStream);
          setPeerConnected(true);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && isSubscribedRef.current && channel) {
          channel.send({
            type: 'broadcast',
            event: 'signal:candidate',
            payload: { candidate: event.candidate.toJSON(), senderId: myUserId },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setPeerConnected(true);
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setPeerConnected(false);
        }
      };

      // If initiator, create offer
      if (isInitiator) {
        pc.onnegotiationneeded = async () => {
          try {
            console.log('[WebRTC] Creating offer (initiator)...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (isSubscribedRef.current && channel) {
              channel.send({
                type: 'broadcast',
                event: 'signal:offer',
                payload: { sdp: offer.sdp, type: offer.type, senderId: myUserId },
              });
            }
          } catch (err) {
            console.warn('[WebRTC] Error during negotiation:', err);
          }
        };
      }

      return pc;
    },
    [],
  );

  // ── Start Local Media (Camera & Mic) ──────────────────────────────────────────
  async function startLocalMedia(type: SessionType): Promise<MediaStream | null> {
    if (type === 'chat') return null;
    try {
      const constraints: MediaStreamConstraints =
        type === 'voice'
          ? { audio: true, video: false }
          : {
              audio: true,
              video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
            };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current && type === 'video') {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not access camera/mic';
      console.warn('[media] getUserMedia failed:', msg);
      setMediaError(
        type === 'voice'
          ? 'Microphone access denied. Please allow mic permissions.'
          : 'Camera/mic access denied. Please allow browser permissions.',
      );
      return null;
    }
  }

  // ── Load Session & Initialize Realtime Signaling ──────────────────────────────
  useEffect(() => {
    if (!sessionId) return;

    let isCancelled = false;

    async function initialize() {
      try {
        const supabase = createClient();
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        const token = authSession?.access_token;
        const myUserId = authSession?.user?.id || '';
        currentUserIdRef.current = myUserId;

        if (!token || !myUserId) {
          setError('Authentication required. Please log in.');
          setState('error');
          return;
        }

        const res = await fetch(`/api/sessions/${sessionId}/livekit-token`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(errBody.message || `Failed to load session (${res.status})`);
        }

        const creds = (await res.json()) as RoomCredentials;
        creds.userId = myUserId;

        if (isCancelled) return;
        setCredentials(creds);
        setState('connecting');

        // 1. Start camera/mic
        const mediaStream = await startLocalMedia(creds.session.type);

        // 2. Start session timer
        timerRef.current = setInterval(() => {
          setElapsed((prev) => {
            if (prev >= SESSION_LIMIT_MINUTES * 60) {
              if (timerRef.current) clearInterval(timerRef.current);
            }
            return prev + 1;
          });
        }, 1000);

        // 3. Setup Supabase Realtime channel for WebRTC signaling & Chat
        const channelName = `therapy-session-${sessionId}`;
        const channel = supabase.channel(channelName, {
          config: { broadcast: { self: false } },
        });
        channelRef.current = channel;

        // Peer-to-peer initiator role: Therapist initiates offer, client answers
        const isInitiator = creds.isTherapist;

        // Create PeerConnection instance
        const pc = createPeerConnection(mediaStream, isInitiator, channel, myUserId);

        // Listen for WebRTC Offer
        channel.on('broadcast', { event: 'signal:offer' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          console.log('[WebRTC] Received offer from peer');
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }),
            );

            // Flush queued ICE candidates
            while (iceCandidateQueueRef.current.length > 0) {
              const cand = iceCandidateQueueRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
            }

            // Create and send answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            channel.send({
              type: 'broadcast',
              event: 'signal:answer',
              payload: { sdp: answer.sdp, type: answer.type, senderId: myUserId },
            });
          } catch (err) {
            console.warn('[WebRTC] Error handling offer:', err);
          }
        });

        // Listen for WebRTC Answer
        channel.on('broadcast', { event: 'signal:answer' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          console.log('[WebRTC] Received answer from peer');
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(
                new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }),
              );
              // Flush queued ICE candidates
              while (iceCandidateQueueRef.current.length > 0) {
                const cand = iceCandidateQueueRef.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
            }
          } catch (err) {
            console.warn('[WebRTC] Error handling answer:', err);
          }
        });

        // Listen for ICE candidates
        channel.on('broadcast', { event: 'signal:candidate' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          try {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
              iceCandidateQueueRef.current.push(payload.candidate);
            }
          } catch (err) {
            console.warn('[WebRTC] Error adding ICE candidate:', err);
          }
        });

        // Listen for Peer Join (trigger offer if initiator)
        channel.on('broadcast', { event: 'peer:joined' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          console.log('[WebRTC] Peer joined room:', payload.senderId);
          setPeerConnected(true);
          if (isInitiator) {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              channel.send({
                type: 'broadcast',
                event: 'signal:offer',
                payload: { sdp: offer.sdp, type: offer.type, senderId: myUserId },
              });
            } catch (err) {
              console.warn('[WebRTC] Failed to send offer on peer join:', err);
            }
          }
        });

        // Listen for In-Session Chat messages
        channel.on('broadcast', { event: 'chat:message' }, ({ payload }: { payload: any }) => {
          const msg = payload as ChatMessage;
          setChatMessages((prev) => [...prev, { ...msg, isSelf: msg.senderId === myUserId }]);
        });

        // Listen for Session End signal
        channel.on('broadcast', { event: 'session:ended' }, () => {
          setSessionEnded(true);
          if (timerRef.current) clearInterval(timerRef.current);
          if (creds.isTherapist) {
            setShowNotesModal(true);
          }
        });

        // Subscribe to channel
        channel.subscribe((status: string) => {
          console.log(`[Supabase Realtime] Channel status: ${status}`);
          if (status === 'SUBSCRIBED') {
            isSubscribedRef.current = true;
            setState('connected');

            // Announce presence to other peer
            channel.send({
              type: 'broadcast',
              event: 'peer:joined',
              payload: { senderId: myUserId, isTherapist: creds.isTherapist },
            });
          }
        });
      } catch (err) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to connect to session';
        setError(msg);
        setState('error');
      }
    }

    initialize();

    return () => {
      isCancelled = true;
      cleanupAll();
    };
  }, [sessionId, createPeerConnection, cleanupAll]);

  // ── Mute / Camera controls ────────────────────────────────────────────────────
  function handleToggleMute() {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = isMuted; // if currently muted, enable track
      });
    }
    setIsMuted((v) => !v);
  }

  function handleToggleCamera() {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach((t) => {
        t.enabled = isCameraOff; // if currently off, enable track
      });
    }
    setIsCameraOff((v) => !v);
  }

  // ── End session ───────────────────────────────────────────────────────────────
  async function handleEndSession() {
    if (timerRef.current) clearInterval(timerRef.current);

    // Inform the other participant via broadcast
    if (channelRef.current && isSubscribedRef.current) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'session:ended',
          payload: { endedBy: currentUserIdRef.current },
        });
      } catch {
        /* best effort */
      }
    }

    // Call API to mark session as completed in database
    try {
      const supabase = createClient();
      const {
        data: { session: authSession },
      } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token || ''}` },
      });
    } catch {
      /* best effort */
    }

    // Stop local hardware tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    setSessionEnded(true);
    setShowEndConfirm(false);

    if (credentials?.isTherapist) {
      setShowNotesModal(true);
    }
  }

  async function handleSaveNotes() {
    if (notes.trim()) {
      setNotesSaving(true);
      try {
        const supabase = createClient();
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
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
        /* best effort */
      }
      setNotesSaving(false);
    }
    setShowNotesModal(false);
    router.push('/dashboard/sessions');
  }

  // ── Chat send ─────────────────────────────────────────────────────────────────
  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || !credentials) return;

    const senderName = credentials.isTherapist
      ? credentials.session.therapist?.fullName || 'Therapist'
      : credentials.session.client?.fullName || 'You';

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderId: currentUserIdRef.current,
      sender: senderName,
      text: chatInput.trim(),
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
    };

    // Add to local state immediately
    setChatMessages((prev) => [...prev, msg]);
    setChatInput('');

    // Broadcast over channel
    if (channelRef.current && isSubscribedRef.current) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'chat:message',
          payload: msg,
        });
      } catch (err) {
        console.warn('[chat] Failed to broadcast message:', err);
      }
    }
  }, [chatInput, credentials]);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const remainingMins = Math.max(0, SESSION_LIMIT_MINUTES - Math.floor(elapsed / 60));
  const timeWarning = remainingMins <= 5 && remainingMins > 0;

  const sessionType = credentials?.session.type || 'video';
  const isVideo = sessionType === 'video';
  const isVoice = sessionType === 'voice';
  const isChat = sessionType === 'chat';

  const otherPersonName = credentials
    ? credentials.isTherapist
      ? credentials.session.client?.fullName || 'Client'
      : credentials.session.therapist?.fullName || 'Therapist'
    : '...';

  // ── Loading / Error screens ────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: '#070b16',
        }}
      >
        <div className="mesh-bg" />
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <IconShield size={42} color="#3b82f6" />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '1rem', fontWeight: 500 }}>
            Authenticating and connecting secure session...
          </p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: '#070b16',
        }}
      >
        <div className="mesh-bg" />
        <div
          className="fade-in-up"
          style={{
            borderRadius: '1.5rem',
            padding: '3rem 2.5rem',
            maxWidth: 460,
            textAlign: 'center',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <IconAlertCircle size={44} color="#ef4444" />
          </div>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              color: '#f8fafc',
            }}
          >
            Cannot Join Session
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '0.95rem' }}>{error}</p>
          <Link
            href="/dashboard/sessions"
            className="btn-primary"
            style={{ padding: '0.75rem 2rem' }}
          >
            ← Back to Sessions
          </Link>
        </div>
      </div>
    );
  }

  // ── Post-session: Notes Modal (Therapist) ────────────────────────────────────
  if (sessionEnded && showNotesModal && credentials?.isTherapist) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '1.5rem',
          background: '#f8fafc',
        }}
      >
        <div className="mesh-bg" />
        <div
          className="fade-in-up"
          style={{
            borderRadius: '1.5rem',
            padding: '2.5rem',
            maxWidth: 520,
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <IconClipboard size={36} color="#3b82f6" />
          </div>
          <h2
            style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              textAlign: 'center',
              marginBottom: '0.5rem',
              color: '#0f172a',
            }}
          >
            Add Clinical Notes
          </h2>
          <p
            style={{
              color: '#64748b',
              fontSize: '0.875rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
            }}
          >
            Private to you. Never shared with the client.
          </p>
          <textarea
            className="input"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Session summary, clinical observations, key breakthroughs..."
            style={{ width: '100%', resize: 'vertical', marginBottom: '1.25rem' }}
          />
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={() => {
                setShowNotesModal(false);
                router.push('/dashboard/sessions');
              }}
              className="btn-ghost"
              style={{ flex: 1, padding: '0.75rem' }}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={notesSaving}
              className="btn-primary"
              style={{
                flex: 2,
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <IconSave size={16} color="#fff" />
              {notesSaving ? 'Saving...' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Post-Session: Therapist Summary ────────────────────────────────────────────
  if (sessionEnded && credentials?.isTherapist) {
    const durationMin = Math.floor(elapsed / 60);
    const durationSec = elapsed % 60;
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '1.5rem',
          background: '#f8fafc',
        }}
      >
        <div className="mesh-bg" />
        <div
          className="fade-in-up"
          style={{
            borderRadius: '1.5rem',
            padding: '2.5rem',
            maxWidth: 520,
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 1.25rem',
              border: '2px solid #a7f3d0',
            }}
          >
            ✅
          </div>
          <h2
            style={{
              fontSize: '1.65rem',
              fontWeight: 700,
              marginBottom: '0.5rem',
              color: '#0f172a',
            }}
          >
            Session Completed
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
            The session has concluded and has been recorded as completed.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '1rem',
              padding: '1.25rem',
              marginBottom: '2rem',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.6rem',
                fontSize: '0.9rem',
              }}
            >
              <span style={{ color: '#64748b' }}>Client</span>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{otherPersonName}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.6rem',
                fontSize: '0.9rem',
              }}
            >
              <span style={{ color: '#64748b' }}>Modality</span>
              <span
                style={{
                  fontWeight: 600,
                  color: '#2563eb',
                  textTransform: 'capitalize',
                }}
              >
                {credentials.session.type} Session
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
              <span style={{ color: '#64748b' }}>Duration</span>
              <span style={{ fontWeight: 600, color: '#059669' }}>
                {durationMin}m {durationSec}s
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', fontWeight: 700 }}
          >
            Return to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── Post-Session: Client Review & Donation ────────────────────────────────────
  if (sessionEnded && !credentials?.isTherapist) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '1.5rem',
          background: '#f8fafc',
        }}
      >
        <div className="mesh-bg" />
        <div
          className="fade-in-up"
          style={{
            borderRadius: '1.5rem',
            padding: '2.5rem',
            maxWidth: 520,
            width: '100%',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 50px rgba(0,0,0,0.08)',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              margin: '0 auto 1rem',
            }}
          >
            🌟
          </div>
          <h2
            style={{
              fontSize: '1.65rem',
              fontWeight: 700,
              marginBottom: '0.35rem',
              color: '#0f172a',
            }}
          >
            How was your session?
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
            Your consultation with <strong>{otherPersonName}</strong> has ended. We hope you felt
            supported.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}
          >
            <button
              type="button"
              onClick={() => router.push('/dashboard/schedule')}
              className="btn-primary"
              style={{ padding: '0.85rem', fontSize: '0.95rem', fontWeight: 600 }}
            >
              Book Follow-up Consultation →
            </button>
            <button
              type="button"
              onClick={() => router.push('/donate')}
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d4ed8',
                borderRadius: '0.75rem',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              ❤️ Support Platform with Voluntary UPI Donation
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="btn-ghost"
              style={{ padding: '0.75rem', fontSize: '0.9rem' }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Live Session Room UI ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#070b16',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="mesh-bg" />

      {/* Hidden background audio player for remote participant voice */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Media permission error banner */}
      {mediaError && (
        <div
          style={{
            position: 'fixed',
            top: '4.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '0.75rem',
            padding: '0.6rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#f87171',
            fontWeight: 600,
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          <IconAlertCircle size={18} color="#f87171" />
          <span>{mediaError}</span>
          <button
            type="button"
            onClick={() => setMediaError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f87171',
              cursor: 'pointer',
              marginLeft: '0.5rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(10, 15, 30, 0.9)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: '#fdfbf7' }}>Help Me!</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: state === 'connected' ? '#10b981' : '#f59e0b',
                boxShadow: state === 'connected' ? '0 0 8px #10b981' : 'none',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              {state === 'connecting' ? (
                'Connecting...'
              ) : (
                <>
                  Live with <strong style={{ color: '#f9fafb' }}>{otherPersonName}</strong>{' '}
                  {peerConnected ? (
                    <span style={{ color: '#10b981', fontSize: '0.8rem' }}>(Connected)</span>
                  ) : (
                    <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>(Waiting for peer...)</span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: timeWarning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${timeWarning ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '0.5rem',
              padding: '0.35rem 0.75rem',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: timeWarning ? '#f87171' : '#9ca3af' }}>⏱</span>
            <span
              style={{
                fontWeight: 700,
                color: timeWarning ? '#f87171' : '#f9fafb',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTime(elapsed)}
            </span>
            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>
              / {SESSION_LIMIT_MINUTES}m
            </span>
          </div>

          {/* Modality Badge */}
          <span
            style={{
              background: 'rgba(58, 91, 239, 0.15)',
              border: '1px solid rgba(58, 91, 239, 0.3)',
              color: '#85a8ff',
              padding: '0.3rem 0.7rem',
              borderRadius: '0.4rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'capitalize',
            }}
          >
            {sessionType}
          </span>

          {/* Chat Toggle */}
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
              {chatMessages.length > 0 && (
                <span
                  style={{
                    background: '#3b82f6',
                    color: '#fff',
                    borderRadius: '1rem',
                    padding: '0.05rem 0.4rem',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                  }}
                >
                  {chatMessages.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 5,
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              gap: '1.5rem',
              position: 'relative',
            }}
          >
            {/* 1. Video Mode */}
            {isVideo && (
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  maxHeight: 'calc(100vh - 170px)',
                  gap: '1.25rem',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Remote Participant Video Feed */}
                <div
                  style={{
                    flex: 1,
                    maxWidth: 820,
                    height: '100%',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                  }}
                >
                  {remoteStream ? (
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '1rem',
                      }}
                    >
                      <div
                        style={{
                          width: 88,
                          height: 88,
                          borderRadius: '50%',
                          background: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2.2rem',
                          color: '#ffffff',
                          fontWeight: 700,
                          boxShadow: '0 0 30px rgba(37, 99, 235, 0.4)',
                        }}
                      >
                        {otherPersonName.charAt(0)}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                        {peerConnected
                          ? `${otherPersonName} (Video paused/starting...)`
                          : `Waiting for ${otherPersonName} to join live room...`}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      position: 'absolute',
                      bottom: '1rem',
                      left: '1rem',
                      background: 'rgba(0,0,0,0.65)',
                      backdropFilter: 'blur(8px)',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.8rem',
                      color: '#f9fafb',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: peerConnected ? '#10b981' : '#f59e0b',
                      }}
                    />
                    <span>{otherPersonName}</span>
                  </div>
                </div>

                {/* Local Self-view Camera */}
                <div
                  style={{
                    width: 260,
                    height: 195,
                    background: isCameraOff ? 'rgba(255, 255, 255, 0.03)' : '#000',
                    border: `1px solid ${isCameraOff ? 'rgba(255,255,255,0.08)' : 'rgba(59, 130, 246, 0.4)'}`,
                    borderRadius: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                  }}
                >
                  {isCameraOff ? (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <IconVideoOff size={32} color="#64748b" />
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Camera Off</span>
                    </div>
                  ) : (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)',
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '0.5rem',
                      left: '0.5rem',
                      background: 'rgba(0,0,0,0.65)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.35rem',
                      fontSize: '0.75rem',
                      color: '#f9fafb',
                    }}
                  >
                    You {isMuted && '🔇'}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Voice Mode */}
            {isVoice && (
              <div style={{ textAlign: 'center', maxWidth: 440 }}>
                <div
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    background: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.75rem',
                    boxShadow: '0 0 45px rgba(37, 99, 235, 0.4)',
                    position: 'relative',
                  }}
                >
                  <IconMic size={54} color="#FFFFFF" />
                </div>
                <h2
                  style={{
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    marginBottom: '0.5rem',
                    color: '#f9fafb',
                  }}
                >
                  Voice Consultation with {otherPersonName}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
                  {peerConnected ? 'Live Audio Connected' : `Waiting for ${otherPersonName}...`}
                </p>

                {peerConnected && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      marginTop: '1.5rem',
                    }}
                  >
                    {[...Array(9)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 4,
                          height: 10 + Math.sin(i * 0.8) * 14,
                          borderRadius: 2,
                          background: isMuted ? '#475569' : '#3b82f6',
                          transition: 'height 0.15s ease',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Full Chat Mode */}
            {isChat && (
              <div
                style={{
                  flex: 1,
                  maxWidth: 720,
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  background: 'rgba(15, 23, 42, 0.5)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '1rem',
                  overflow: 'hidden',
                }}
              >
                <ChatPanel
                  messages={chatMessages}
                  chatInput={chatInput}
                  onInputChange={setChatInput}
                  onSend={sendChatMessage}
                  otherPersonName={otherPersonName}
                />
              </div>
            )}
          </div>
        </div>

        {/* Side Chat Panel (for video/voice sessions) */}
        {!isChat && showChat && (
          <div
            style={{
              width: 330,
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(10, 15, 30, 0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '0.85rem 1rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>In-Session Chat</span>
              <button
                type="button"
                onClick={() => setShowChat(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
            </div>
            <ChatPanel
              messages={chatMessages}
              chatInput={chatInput}
              onInputChange={setChatInput}
              onSend={sendChatMessage}
              otherPersonName={otherPersonName}
            />
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(7, 11, 22, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          flexShrink: 0,
        }}
      >
        {/* Mute Button */}
        <ControlButton
          onClick={handleToggleMute}
          active={!isMuted}
          icon={
            isMuted ? (
              <IconMicOff size={22} color="#f87171" />
            ) : (
              <IconMic size={22} color="#FFFFFF" />
            )
          }
          label={isMuted ? 'Unmute' : 'Mute'}
        />

        {/* Camera Button (Video only) */}
        {isVideo && (
          <ControlButton
            onClick={handleToggleCamera}
            active={!isCameraOff}
            icon={
              isCameraOff ? (
                <IconVideoOff size={22} color="#f87171" />
              ) : (
                <IconVideo size={22} color="#FFFFFF" />
              )
            }
            label={isCameraOff ? 'Show Cam' : 'Hide Cam'}
          />
        )}

        {/* Chat Toggle (Voice/Video) */}
        {!isChat && (
          <ControlButton
            onClick={() => setShowChat((v) => !v)}
            active={showChat}
            icon={<IconMessageSquare size={22} color={showChat ? '#60a5fa' : '#FFFFFF'} />}
            label="Chat"
          />
        )}

        {/* End Call Button */}
        <button
          type="button"
          onClick={() => setShowEndConfirm(true)}
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.95)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
            transition: 'transform 0.15s',
          }}
          title="End Consultation"
        >
          <IconCross size={24} color="#FFFFFF" style={{ transform: 'rotate(45deg)' }} />
        </button>
      </div>

      {/* End Confirm Modal */}
      {showEndConfirm && !sessionEnded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            className="fade-in-up"
            style={{
              borderRadius: '1.5rem',
              padding: '2.5rem',
              maxWidth: 440,
              width: '100%',
              textAlign: 'center',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <IconCross size={36} color="#ef4444" style={{ transform: 'rotate(45deg)' }} />
            </div>
            <h3
              style={{
                fontSize: '1.35rem',
                fontWeight: 700,
                marginBottom: '0.5rem',
                color: '#1e293b',
              }}
            >
              End session now?
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
              The session will conclude for both participants.
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
                style={{ padding: '0.65rem 1.75rem', fontWeight: 600, background: '#ef4444' }}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-minute Warning Banner */}
      {timeWarning && state === 'connected' && (
        <div
          style={{
            position: 'fixed',
            top: '4.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '0.75rem',
            padding: '0.6rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#f87171',
            fontWeight: 600,
          }}
        >
          <IconAlertCircle size={18} color="#f87171" />
          <span>
            {remainingMins} minute{remainingMins !== 1 ? 's' : ''} remaining in this session
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ControlButton({
  onClick,
  active,
  icon,
  label,
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
        width: 50,
        height: 50,
        borderRadius: '50%',
        background: active ? 'rgba(255, 255, 255, 0.08)' : 'rgba(239, 68, 68, 0.2)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.12)' : 'rgba(239, 68, 68, 0.4)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {icon}
    </button>
  );
}

function ChatPanel({
  messages,
  chatInput,
  onInputChange,
  onSend,
  otherPersonName,
}: {
  messages: ChatMessage[];
  chatInput: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  otherPersonName: string;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Messages list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.85rem',
              marginTop: '2rem',
              padding: '0 1rem',
            }}
          >
            <p>
              Send a message to start chatting with <strong>{otherPersonName}</strong>.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.isSelf ? 'flex-end' : 'flex-start',
              gap: '0.2rem',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {msg.isSelf ? 'You' : msg.sender} · {msg.ts}
            </span>
            <div
              style={{
                background: msg.isSelf ? '#2563eb' : 'rgba(255,255,255,0.08)',
                border: msg.isSelf ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: msg.isSelf
                  ? '0.75rem 0.75rem 0.2rem 0.75rem'
                  : '0.75rem 0.75rem 0.75rem 0.2rem',
                padding: '0.6rem 0.9rem',
                fontSize: '0.9rem',
                color: '#f9fafb',
                maxWidth: '85%',
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: '0.85rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          gap: '0.5rem',
        }}
      >
        <input
          type="text"
          value={chatInput}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '0.65rem',
            padding: '0.55rem 0.9rem',
            color: '#f9fafb',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!chatInput.trim()}
          className="btn-primary"
          style={{
            padding: '0.5rem 0.9rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconSend size={15} color="#fff" />
        </button>
      </div>
    </div>
  );
}
