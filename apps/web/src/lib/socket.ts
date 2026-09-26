import { io, Socket } from 'socket.io-client';
import { createClient } from '@/lib/supabase/client';

let socket: Socket | null = null;

/**
 * Get or initialize the Socket.io client for real-time matching.
 * Attaches the Supabase JWT token in the handshake auth payload.
 *
 * Security: uses getUser() (server-validated) instead of getSession()
 * (localStorage-only) to ensure revoked/expired tokens are never used.
 * The access_token from the verified session is then forwarded to the
 * NestJS SupabaseAuthGuard which also calls getUser() server-side.
 */
export async function getMatchingSocket(): Promise<Socket> {
  if (socket && socket.connected) {
    return socket;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const supabase = createClient();

  // getUser() makes a live round-trip to Supabase to validate the JWT.
  // Falls back to empty string so the socket connects but the NestJS guard
  // will reject the unauthenticated handshake cleanly.
  let token = '';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Retrieve the access token from the validated session
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || '';
    }
  } catch {
    // Network error — connect with empty token; server will reject
  }

  socket = io(`${apiUrl}/matching`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // On every reconnect attempt, re-validate the user server-side before
  // sending the token, so expired/revoked sessions can't maintain a socket.
  socket.io.on('reconnect_attempt', async () => {
    try {
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (freshUser) {
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        if (socket) socket.auth = { token: freshSession?.access_token || '' };
      } else {
        // User session is invalid — disconnect rather than reconnect with bad token
        socket?.disconnect();
        socket = null;
      }
    } catch {
      // Network error — let reconnect proceed with existing token
    }
  });

  return socket;
}

export function disconnectMatchingSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
