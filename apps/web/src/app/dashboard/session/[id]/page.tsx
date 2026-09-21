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
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);
  const [isSyntheticMedia, setIsSyntheticMedia] = useState(false);

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
  const localIceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const handshakeWatchdogRef = useRef<NodeJS.Timeout | null>(null);
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
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current
        .play()
        .then(() => {
          setAudioAutoplayBlocked(false);
        })
        .catch(() => {
          // Mobile browser autoplay policy blocked audio; unlock on user tap
          setAudioAutoplayBlocked(true);
        });
    }
  }, [remoteStream]);

  // ── Unlock mobile audio on first user touch/click anywhere on screen ──────────
  useEffect(() => {
    const unlockAudio = () => {
      if (remoteAudioRef.current && remoteStream) {
        remoteAudioRef.current
          .play()
          .then(() => setAudioAutoplayBlocked(false))
          .catch(() => {});
      }
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
    return () => {
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
  }, [remoteStream]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  const cleanupAll = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (handshakeWatchdogRef.current) clearInterval(handshakeWatchdogRef.current);
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
    isSubscribedRef.current = false;
  }, []);

  useEffect(() => {
    return () => cleanupAll();
  }, [cleanupAll]);

  // ── Synthetic Media Stream Generator (Fallback when Camera/Mic blocked or on HTTP)
  const createSyntheticMediaStream = useCallback(
    (displayName: string, type: SessionType): MediaStream => {
      const stream = new MediaStream();

      // 1. Silent WebAudio track to keep RTC audio channel alive and valid
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const dst = ctx.createMediaStreamDestination();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001; // virtually silent
          osc.connect(gain);
          gain.connect(dst);
          osc.start();
          const audioTrack = dst.stream.getAudioTracks()[0];
          if (audioTrack) stream.addTrack(audioTrack);
        }
      } catch (e) {
        console.warn('[media] Could not create fallback synthetic audio track:', e);
      }

      // 2. High-DPI Canvas Stream to keep RTC video channel alive
      if (type === 'video') {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            let frame = 0;
            const drawPlaceholder = () => {
              frame += 0.05;
              const grad = ctx.createLinearGradient(0, 0, 640, 480);
              grad.addColorStop(0, '#090d1a');
              grad.addColorStop(1, '#1e293b');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, 640, 480);

              // Pulsing aura ring
              const pulse = Math.sin(frame) * 12;
              const aura = ctx.createRadialGradient(320, 210, 40, 320, 210, 95 + pulse);
              aura.addColorStop(0, 'rgba(59, 130, 246, 0.45)');
              aura.addColorStop(1, 'rgba(59, 130, 246, 0)');
              ctx.fillStyle = aura;
              ctx.beginPath();
              ctx.arc(320, 210, 95 + pulse, 0, Math.PI * 2);
              ctx.fill();

              // Avatar circle
              ctx.beginPath();
              ctx.arc(320, 210, 64, 0, Math.PI * 2);
              ctx.fillStyle = '#2563eb';
              ctx.fill();
              ctx.lineWidth = 3;
              ctx.strokeStyle = '#60a5fa';
              ctx.stroke();

              // Initial
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 50px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              const initial = (displayName || 'User').charAt(0).toUpperCase();
              ctx.fillText(initial, 320, 212);

              // Name label
              ctx.fillStyle = '#f8fafc';
              ctx.font = '600 20px sans-serif';
              ctx.fillText(displayName || 'User', 320, 310);

              // Sub-text
              ctx.fillStyle = '#94a3b8';
              ctx.font = '14px sans-serif';
              ctx.fillText('Camera Disabled (Tap Allow to enable)', 320, 340);
            };

            drawPlaceholder();
            const timer = setInterval(drawPlaceholder, 200);
            const canvasStream =
              canvas.captureStream ? canvas.captureStream(10) : (canvas as any).mozCaptureStream?.(10);
            if (canvasStream) {
              const videoTrack = canvasStream.getVideoTracks()[0];
              if (videoTrack) {
                videoTrack.addEventListener('ended', () => clearInterval(timer));
                stream.addTrack(videoTrack);
              }
            }
          }
        } catch (e) {
          console.warn('[media] Could not create fallback synthetic video track:', e);
        }
      }

      return stream;
    },
    [],
  );

  // ── Start Local Media (Camera & Mic with Synthetic Fallback) ──────────────────
  const startLocalMedia = useCallback(
    async (type: SessionType, displayName: string): Promise<MediaStream> => {
      if (type === 'chat') return new MediaStream();

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('getUserMedia not supported on this browser/insecure context');
        }

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
        setIsSyntheticMedia(false);
        setMediaError(null);

        if (localVideoRef.current && type === 'video') {
          localVideoRef.current.srcObject = stream;
        }
        return stream;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Permission denied';
        console.warn('[media] Real media failed, activating synthetic fallback stream:', msg);
        setIsSyntheticMedia(true);
        setMediaError(
          'Microphone/Camera blocked or insecure context. Synthetic placeholder active. Click "Allow Camera & Mic" to enable real feed.',
        );

        const fallback = createSyntheticMediaStream(displayName, type);
        localStreamRef.current = fallback;
        setLocalStream(fallback);

        if (localVideoRef.current && type === 'video') {
          localVideoRef.current.srcObject = fallback;
        }
        return fallback;
      }
    },
    [createSyntheticMediaStream],
  );

  // ── Retry Real Camera / Mic on user gesture ──────────────────────────────────
  async function retryUserMedia() {
    if (!credentials) return;
    try {
      const constraints: MediaStreamConstraints =
        credentials.session.type === 'voice'
          ? { audio: true, video: false }
          : {
              audio: true,
              video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 },
              },
            };

      const realStream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = realStream;
      setLocalStream(realStream);
      setIsSyntheticMedia(false);
      setMediaError(null);

      if (localVideoRef.current && credentials.session.type === 'video') {
        localVideoRef.current.srcObject = realStream;
      }

      // Upgrade active RTCPeerConnection tracks on the fly using replaceTrack
      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoTrack = realStream.getVideoTracks()[0];
        const audioTrack = realStream.getAudioTracks()[0];

        if (videoTrack) {
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(videoTrack).catch((e) => console.warn('replaceTrack video error:', e));
          } else {
            pcRef.current.addTrack(videoTrack, realStream);
          }
        }
        if (audioTrack) {
          const audioSender = senders.find((s) => s.track?.kind === 'audio');
          if (audioSender) {
            audioSender.replaceTrack(audioTrack).catch((e) => console.warn('replaceTrack audio error:', e));
          } else {
            pcRef.current.addTrack(audioTrack, realStream);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Permission denied';
      setMediaError(`Permission error: ${msg}. If testing on mobile HTTP, allow camera/mic in browser settings.`);
    }
  }

  // ── WebRTC Signaling Helpers ─────────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (stream: MediaStream | null, channel: any, myUserId: string) => {
      if (pcRef.current) {
        pcRef.current.close();
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Add local tracks
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
        if (event.candidate) {
          if (isSubscribedRef.current && channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'signal:candidate',
              payload: { candidate: event.candidate.toJSON(), senderId: myUserId },
            });
          } else {
            localIceQueueRef.current.push(event.candidate.toJSON());
          }
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

      return pc;
    },
    [],
  );

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

        const myName = creds.isTherapist
          ? creds.session.therapist?.fullName || 'Therapist'
          : creds.session.client?.fullName || 'Client';

        // 1. Start media (real or synthetic fallback)
        const mediaStream = await startLocalMedia(creds.session.type, myName);

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

        // Deterministic initiator: Therapist initiates offer; if neither, fallback to lexicographical ID
        const isInitiator = creds.isTherapist;

        // Create PeerConnection instance
        const pc = createPeerConnection(mediaStream, channel, myUserId);

        // Helper to generate & broadcast an offer
        async function sendOffer() {
          if (!pcRef.current || !channelRef.current || !isSubscribedRef.current) return;
          try {
            console.log('[WebRTC] Creating and sending offer...');
            const offer = await pcRef.current.createOffer();
            await pcRef.current.setLocalDescription(offer);
            channelRef.current.send({
              type: 'broadcast',
              event: 'signal:offer',
              payload: { sdp: offer.sdp, type: offer.type, senderId: myUserId },
            });
          } catch (err) {
            console.warn('[WebRTC] Failed to create/send offer:', err);
          }
        }

        // Listen for WebRTC Offer
        channel.on('broadcast', { event: 'signal:offer' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          console.log('[WebRTC] Received offer from peer');
          setPeerConnected(true);
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }),
            );

            // Flush queued ICE candidates
            while (iceCandidateQueueRef.current.length > 0) {
              const cand = iceCandidateQueueRef.current.shift();
              if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
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
          setPeerConnected(true);
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(
                new RTCSessionDescription({ type: payload.type, sdp: payload.sdp }),
              );
              while (iceCandidateQueueRef.current.length > 0) {
                const cand = iceCandidateQueueRef.current.shift();
                if (cand) await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
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
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } else {
              iceCandidateQueueRef.current.push(payload.candidate);
            }
          } catch (err) {
            console.warn('[WebRTC] Error adding ICE candidate:', err);
          }
        });

        // Listen for Peer Join / Ping / Pong (Full bi-directional handshake to eliminate deadlock)
        channel.on('broadcast', { event: 'peer:joined' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          console.log('[WebRTC] Peer joined room:', payload.senderId);
          setPeerConnected(true);
          // Respond with pong so the joining peer knows we are present
          channel.send({
            type: 'broadcast',
            event: 'peer:pong',
            payload: { senderId: myUserId, isTherapist: creds.isTherapist },
          });
          if (isInitiator) {
            sendOffer();
          }
        });

        channel.on('broadcast', { event: 'peer:ping' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          setPeerConnected(true);
          channel.send({
            type: 'broadcast',
            event: 'peer:pong',
            payload: { senderId: myUserId, isTherapist: creds.isTherapist },
          });
          if (isInitiator) {
            sendOffer();
          }
        });

        channel.on('broadcast', { event: 'peer:pong' }, async ({ payload }: { payload: any }) => {
          if (payload.senderId === myUserId) return;
          console.log('[WebRTC] Peer confirmed presence (pong):', payload.senderId);
          setPeerConnected(true);
          if (isInitiator) {
            sendOffer();
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

            // Flush buffered local ICE candidates
            while (localIceQueueRef.current.length > 0) {
              const cand = localIceQueueRef.current.shift();
              if (cand) {
                channel.send({
                  type: 'broadcast',
                  event: 'signal:candidate',
                  payload: { candidate: cand, senderId: myUserId },
                });
              }
            }

            // Announce presence to other peer
            channel.send({
              type: 'broadcast',
              event: 'peer:joined',
              payload: { senderId: myUserId, isTherapist: creds.isTherapist },
            });
            channel.send({
              type: 'broadcast',
              event: 'peer:ping',
              payload: { senderId: myUserId, isTherapist: creds.isTherapist },
            });

            if (isInitiator) {
              sendOffer();
            }

            // 4. Watchdog: ping every 3s if not yet connected, re-negotiate if needed
            handshakeWatchdogRef.current = setInterval(() => {
              if (pcRef.current?.connectionState === 'connected') {
                if (handshakeWatchdogRef.current) clearInterval(handshakeWatchdogRef.current);
                return;
              }
              if (isSubscribedRef.current && channelRef.current) {
                channelRef.current.send({
                  type: 'broadcast',
                  event: 'peer:ping',
                  payload: { senderId: myUserId, isTherapist: creds.isTherapist },
                });
                if (isInitiator && pcRef.current?.signalingState === 'stable') {
                  sendOffer();
                }
              }
            }, 3000);
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
  }, [sessionId, createPeerConnection, startLocalMedia, cleanupAll]);


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

      {/* Background audio player for remote participant voice */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{
          position: 'fixed',
          bottom: 0,
          right: 0,
          width: 1,
          height: 1,
          opacity: 0.001,
          pointerEvents: 'none',
        }}
      />

      {/* Autoplay blocked banner */}
      {audioAutoplayBlocked && (
        <button
          type="button"
          onClick={() => {
            if (remoteAudioRef.current) {
              remoteAudioRef.current
                .play()
                .then(() => setAudioAutoplayBlocked(false))
                .catch(() => {});
            }
          }}
          style={{
            position: 'fixed',
            bottom: '5.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 250,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#ffffff',
            padding: '0.65rem 1.4rem',
            borderRadius: '2rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            boxShadow: '0 8px 25px rgba(37, 99, 235, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            animation: 'pulse 2s infinite',
          }}
        >
          <span>🔊 Tap to Unmute Live Voice</span>
        </button>
      )}

      {/* Media permission error banner */}
      {mediaError && (
        <div
          style={{
            position: 'fixed',
            top: '4.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 200,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            borderRadius: '0.85rem',
            padding: '0.65rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.85rem',
            color: '#fca5a5',
            fontWeight: 500,
            maxWidth: '92vw',
            backdropFilter: 'blur(12px)',
          }}
        >
          <IconAlertCircle size={20} color="#ef4444" />
          <span style={{ maxWidth: 360, lineHeight: 1.4 }}>{mediaError}</span>
          <button
            type="button"
            onClick={retryUserMedia}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Allow Camera & Mic
          </button>
          <button
            type="button"
            onClick={() => setMediaError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              marginLeft: '0.25rem',
              fontSize: '1rem',
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
          padding: '0.6rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span className="text-sm sm:text-base font-extrabold hidden xs:inline-block">
            <span className="gradient-text">Jarwis</span>{' '}
            <span style={{ color: '#fdfbf7' }}>Help Me!</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: state === 'connected' ? '#10b981' : '#f59e0b',
                boxShadow: state === 'connected' ? '0 0 8px #10b981' : 'none',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              {state === 'connecting' ? (
                'Connecting...'
              ) : (
                <>
                  <span className="hidden sm:inline">Live with </span>
                  <strong style={{ color: '#f9fafb' }} className="max-w-[110px] sm:max-w-none truncate inline-block align-bottom">{otherPersonName}</strong>{' '}
                  {peerConnected ? (
                    <span style={{ color: '#10b981', fontSize: '0.75rem' }}>● Connected</span>
                  ) : (
                    <span style={{ color: '#f59e0b', fontSize: '0.75rem' }}>● Waiting</span>
                  )}
                </>
              )}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                className="flex flex-col md:flex-row w-full h-full gap-3 md:gap-5 items-center justify-center relative"
                style={{
                  maxHeight: 'calc(100vh - 160px)',
                }}
              >
                {/* Remote Participant Video Feed */}
                <div
                  style={{
                    flex: 1,
                    width: '100%',
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

                {/* Local Self-view Camera: PiP on mobile, standard on desktop */}
                <div
                  className="mobile-pip-card"
                  style={{
                    background: isCameraOff ? 'rgba(255, 255, 255, 0.03)' : '#000',
                    border: `1px solid ${isCameraOff ? 'rgba(255,255,255,0.08)' : 'rgba(59, 130, 246, 0.4)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
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
            className="fixed inset-x-0 bottom-0 top-16 z-50 md:static md:w-[330px] md:top-auto flex flex-col"
            style={{
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(10, 15, 30, 0.95)',
              backdropFilter: 'blur(16px)',
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
                  fontSize: '1.1rem',
                  padding: '0.2rem 0.5rem',
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
        className="pb-safe"
        style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(7, 11, 22, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.65rem',
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
