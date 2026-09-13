import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { SessionType, TherapistPresence, SessionMatchedPayload } from '@therapy/shared-types';
import { MATCHING_TIMEOUT_MS } from '@therapy/config';

interface ActiveMatch {
  sessionId: string;
  clientId: string;
  clientName: string;
  type: SessionType;
  timeoutTimer: NodeJS.Timeout;
  expiresAt: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  // In-memory presence map: therapistUserId -> presence
  private readonly onlineTherapists = new Map<string, TherapistPresence>();

  // In-memory active matching requests: sessionId -> ActiveMatch
  private readonly activeMatches = new Map<string, ActiveMatch>();

  constructor(private readonly supabase: SupabaseService) {}

  /** Register or update therapist presence */
  async setTherapistPresence(userId: string, socketId: string, isAvailable: boolean) {
    const presence: TherapistPresence = {
      therapistId: userId,
      userId,
      socketId,
      isAvailable,
      lastSeenAt: new Date().toISOString(),
    };

    if (isAvailable) {
      this.onlineTherapists.set(userId, presence);
    } else {
      this.onlineTherapists.delete(userId);
    }

    // Also update DB presence flag asynchronously
    this.supabase.client
      .from('therapist_profiles')
      .update({ is_available_now: isAvailable })
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) this.logger.warn(`Could not sync is_available_now for ${userId}: ${error.message}`);
      });

    this.logger.log(`Therapist ${userId} presence updated: isAvailable=${isAvailable} (total online: ${this.onlineTherapists.size})`);
    return presence;
  }

  /** Remove therapist on socket disconnect */
  async handleTherapistDisconnect(socketId: string) {
    for (const [userId, p] of this.onlineTherapists.entries()) {
      if (p.socketId === socketId) {
        this.onlineTherapists.delete(userId);
        await this.supabase.client
          .from('therapist_profiles')
          .update({ is_available_now: false })
          .eq('user_id', userId);
        this.logger.log(`Therapist ${userId} disconnected. Removed from available pool.`);
        return userId;
      }
    }
    return null;
  }

  /** Get list of all currently available, approved therapists */
  getAvailableTherapists(): TherapistPresence[] {
    return Array.from(this.onlineTherapists.values()).filter((p) => p.isAvailable);
  }

  /**
   * Client requests an instant session.
   * Creates a 'pending' session row in Postgres and registers active match.
   */
  async createInstantSession(
    clientId: string,
    clientName: string,
    type: SessionType,
    notes?: string,
    onTimeout?: (sessionId: string) => void,
  ) {
    const { data: session, error } = await this.supabase.client
      .from('sessions')
      .insert({
        client_id: clientId,
        type,
        mode: 'instant',
        status: 'pending',
        notes: notes ?? null,
      })
      .select('id, client_id, type, mode, status, created_at')
      .single();

    if (error || !session) {
      this.logger.error(`Failed to create instant session: ${error?.message}`);
      throw new BadRequestException('Could not create session');
    }

    const sessionId = session.id;
    const expiresAt = Date.now() + MATCHING_TIMEOUT_MS;

    const timeoutTimer = setTimeout(async () => {
      await this.handleMatchingTimeout(sessionId);
      if (onTimeout) onTimeout(sessionId);
    }, MATCHING_TIMEOUT_MS);

    this.activeMatches.set(sessionId, {
      sessionId,
      clientId,
      clientName,
      type,
      timeoutTimer,
      expiresAt,
    });

    this.logger.log(`Created instant session ${sessionId} for client ${clientId} (${type})`);

    const availableTherapists = this.getAvailableTherapists();

    return {
      session,
      availableTherapists,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  /**
   * First-to-accept matching race condition handler.
   * Uses atomic database update: only the first therapist who updates status='pending' wins!
   */
  async acceptSession(therapistId: string, sessionId: string): Promise<{
    won: boolean;
    sessionMatched?: SessionMatchedPayload;
    clientId?: string;
  }> {
    const activeMatch = this.activeMatches.get(sessionId);

    // Generate unique LiveKit room name
    const livekitRoomName = `jarwis-session-${sessionId.slice(0, 8)}-${Date.now().toString(36)}`;

    // Atomic update: only updates if status is still 'pending'
    const { data: updated, error } = await this.supabase.client
      .from('sessions')
      .update({
        therapist_id: therapistId,
        status: 'accepted',
        started_at: new Date().toISOString(),
        livekit_room_name: livekitRoomName,
      })
      .eq('id', sessionId)
      .eq('status', 'pending')
      .select('id, client_id, therapist_id, type, livekit_room_name')
      .single();

    if (error || !updated) {
      this.logger.warn(`Therapist ${therapistId} lost race for session ${sessionId} (already accepted or expired).`);
      return { won: false };
    }

    // Clean up timeout timer
    if (activeMatch) {
      clearTimeout(activeMatch.timeoutTimer);
      this.activeMatches.delete(sessionId);
    }

    // Fetch therapist details for reveal
    const { data: therapistUser } = await this.supabase.client
      .from('users')
      .select('full_name, avatar_url')
      .eq('id', therapistId)
      .single();

    const { data: therapistProfile } = await this.supabase.client
      .from('therapist_profiles')
      .select('bio, specializations')
      .eq('user_id', therapistId)
      .single();

    // Mark winning therapist as busy in session
    const currentPresence = this.onlineTherapists.get(therapistId);
    if (currentPresence) {
      currentPresence.isAvailable = false;
    }

    const sessionMatched: SessionMatchedPayload = {
      sessionId,
      therapistId,
      therapistName: therapistUser?.full_name || 'Licensed Therapist',
      therapistAvatarUrl: therapistUser?.avatar_url,
      therapistBio: therapistProfile?.bio,
      specializations: therapistProfile?.specializations ?? [],
      livekitRoomName,
      type: updated.type as SessionType,
    };

    this.logger.log(`Session ${sessionId} successfully accepted by therapist ${therapistId}! Room: ${livekitRoomName}`);

    return {
      won: true,
      sessionMatched,
      clientId: updated.client_id,
    };
  }

  /** Client cancels request before matched */
  async cancelSession(clientId: string, sessionId: string) {
    const active = this.activeMatches.get(sessionId);
    if (active) {
      clearTimeout(active.timeoutTimer);
      this.activeMatches.delete(sessionId);
    }

    const { data, error } = await this.supabase.client
      .from('sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId)
      .eq('client_id', clientId)
      .eq('status', 'pending')
      .select()
      .single();

    return { cancelled: !error && !!data };
  }

  /** Matching timed out without therapist response */
  private async handleMatchingTimeout(sessionId: string) {
    this.activeMatches.delete(sessionId);

    await this.supabase.client
      .from('sessions')
      .update({ status: 'timed_out' })
      .eq('id', sessionId)
      .eq('status', 'pending');

    this.logger.log(`Session ${sessionId} timed out.`);
  }
}
