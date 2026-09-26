import { io, Socket } from 'socket.io-client';
import { createClient } from '@/lib/supabase/client';

let socket: Socket | null = null;

/**
 * Get or initialize the Socket.io client for real-time matching.
 * Attaches the Supabase JWT token in the handshake auth payload.
 */
export async function getMatchingSocket(): Promise<Socket> {
  if (socket && socket.connected) {
    return socket;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || '';

  socket = io(`${apiUrl}/matching`, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Re-fetch token on reconnect to avoid passing stale or expired tokens
  socket.io.on('reconnect_attempt', async () => {
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (socket) {
        socket.auth = { token: freshSession?.access_token || '' };
      }
    } catch {
      // ignore
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
