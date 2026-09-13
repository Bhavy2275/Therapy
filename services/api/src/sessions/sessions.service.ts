import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getUserSessions(userId: string) {
    const { data: sessions, error } = await this.supabase.client
      .from('sessions')
      .select(`
        id,
        client_id,
        therapist_id,
        type,
        mode,
        status,
        scheduled_at,
        started_at,
        ended_at,
        duration_minutes,
        livekit_room_name,
        notes,
        created_at,
        client:users!sessions_client_id_fkey(id, full_name, email, avatar_url),
        therapist:users!sessions_therapist_id_fkey(id, full_name, email, avatar_url)
      `)
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error fetching user sessions: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return (sessions || []).map((s) => {
      const clientObj = (Array.isArray(s.client) ? s.client[0] : s.client) as {
        id?: string;
        full_name?: string;
        email?: string;
        avatar_url?: string;
      } | undefined;

      const therapistObj = (Array.isArray(s.therapist) ? s.therapist[0] : s.therapist) as {
        id?: string;
        full_name?: string;
        email?: string;
        avatar_url?: string;
      } | undefined;

      return {
        id: s.id,
        clientId: s.client_id,
        therapistId: s.therapist_id,
        type: s.type,
        mode: s.mode,
        status: s.status,
        scheduledAt: s.scheduled_at,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        durationMinutes: s.duration_minutes,
        livekitRoomName: s.livekit_room_name,
        notes: s.notes,
        createdAt: s.created_at,
        client: clientObj
          ? {
              id: clientObj.id,
              fullName: clientObj.full_name,
              email: clientObj.email,
              avatarUrl: clientObj.avatar_url,
            }
          : null,
        therapist: therapistObj
          ? {
              id: therapistObj.id,
              fullName: therapistObj.full_name,
              email: therapistObj.email,
              avatarUrl: therapistObj.avatar_url,
            }
          : null,
      };
    });
  }

  async getSessionById(userId: string, sessionId: string) {
    const { data: s, error } = await this.supabase.client
      .from('sessions')
      .select(`
        id,
        client_id,
        therapist_id,
        type,
        mode,
        status,
        scheduled_at,
        started_at,
        ended_at,
        duration_minutes,
        livekit_room_name,
        notes,
        created_at,
        client:users!sessions_client_id_fkey(id, full_name, email, avatar_url),
        therapist:users!sessions_therapist_id_fkey(id, full_name, email, avatar_url)
      `)
      .eq('id', sessionId)
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`)
      .single();

    if (error || !s) {
      throw new NotFoundException('Session not found or unauthorized access');
    }

    const clientObj = (Array.isArray(s.client) ? s.client[0] : s.client) as {
      id?: string;
      full_name?: string;
      email?: string;
      avatar_url?: string;
    } | undefined;

    const therapistObj = (Array.isArray(s.therapist) ? s.therapist[0] : s.therapist) as {
      id?: string;
      full_name?: string;
      email?: string;
      avatar_url?: string;
    } | undefined;

    return {
      id: s.id,
      clientId: s.client_id,
      therapistId: s.therapist_id,
      type: s.type,
      mode: s.mode,
      status: s.status,
      scheduledAt: s.scheduled_at,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      durationMinutes: s.duration_minutes,
      livekitRoomName: s.livekit_room_name,
      notes: s.notes,
      createdAt: s.created_at,
      client: clientObj
        ? {
            id: clientObj.id,
            fullName: clientObj.full_name,
            email: clientObj.email,
            avatarUrl: clientObj.avatar_url,
          }
        : null,
      therapist: therapistObj
        ? {
            id: therapistObj.id,
            fullName: therapistObj.full_name,
            email: therapistObj.email,
            avatarUrl: therapistObj.avatar_url,
          }
        : null,
    };
  }

  async cancelSession(userId: string, sessionId: string) {
    const { data, error } = await this.supabase.client
      .from('sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)
      .or(`client_id.eq.${userId},therapist_id.eq.${userId}`)
      .in('status', ['pending', 'accepted'])
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestException('Session cannot be cancelled');
    }

    return { success: true, message: 'Session cancelled' };
  }

  async getLivekitToken(userId: string, sessionId: string) {
    const session = await this.getSessionById(userId, sessionId);

    if (session.status === 'accepted') {
      await this.supabase.client
        .from('sessions')
        .update({
          status: 'in_progress',
          started_at: session.startedAt || new Date().toISOString(),
        })
        .eq('id', sessionId);
      session.status = 'in_progress';
    }

    const livekitUrl = process.env.LIVEKIT_URL || '';
    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    const roomName = session.livekitRoomName || `session-${session.id}`;

    const isTherapist = session.therapistId === userId;
    const participantName = isTherapist
      ? session.therapist?.fullName || 'Therapist'
      : session.client?.fullName || 'Client';

    let token: string | null = null;
    try {
      const { AccessToken } = await import('livekit-server-sdk');
      const at = new AccessToken(apiKey, apiSecret, {
        identity: userId,
        name: participantName,
      });
      at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
      });
      token = await at.toJwt();
    } catch (err) {
      this.logger.warn(`Could not sign LiveKit token: ${err}`);
    }

    return {
      token,
      livekitUrl,
      roomName,
      session,
      isTherapist,
    };
  }

  async endSession(userId: string, sessionId: string) {
    const session = await this.getSessionById(userId, sessionId);

    const endedAt = new Date();
    const startedAt = session.startedAt ? new Date(session.startedAt) : endedAt;
    const durationMinutes = Math.max(
      1,
      Math.round((endedAt.getTime() - startedAt.getTime()) / 60000),
    );

    const { data, error } = await this.supabase.client
      .from('sessions')
      .update({
        status: 'completed',
        ended_at: endedAt.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Could not complete session: ${error.message}`);
    }

    return { success: true, session: data, durationMinutes };
  }

  async saveSessionNotes(userId: string, sessionId: string, notes: string) {
    const { data: session } = await this.supabase.client
      .from('sessions')
      .select('therapist_id')
      .eq('id', sessionId)
      .single();

    if (!session || session.therapist_id !== userId) {
      throw new BadRequestException('Only the session therapist can submit clinical notes');
    }

    const { data, error } = await this.supabase.client
      .from('sessions')
      .update({ notes })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Failed to save notes: ${error.message}`);
    }

    return { success: true, session: data };
  }
}
