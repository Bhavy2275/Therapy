import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MatchingService } from './matching.service.js';
import { SupabaseService } from '../supabase/supabase.service.js';
import type {
  SessionType,
  ClientSessionRequestPayload,
  TherapistOfferPayload,
  SessionMatchedPayload,
} from '@therapy/shared-types';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    role?: string;
    fullName?: string;
  };
}

@WebSocketGateway({
  namespace: '/matching',
  cors: {
    origin: ['http://localhost:3000', process.env.WEB_URL ?? ''].filter(Boolean),
    credentials: true,
  },
})
export class MatchingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MatchingGateway.name);

  constructor(
    private readonly matchingService: MatchingService,
    private readonly supabase: SupabaseService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.debug(`Socket ${client.id} connected without token (guest).`);
        return;
      }

      const { data, error } = await this.supabase.client.auth.getUser(token);
      if (error || !data.user) {
        this.logger.warn(`Socket auth failed: ${error?.message}`);
        return;
      }

      const userId = data.user.id;
      const role = data.user.user_metadata?.role || 'client';
      const fullName = data.user.user_metadata?.full_name || 'User';

      client.data.userId = userId;
      client.data.role = role;
      client.data.fullName = fullName;

      // Join direct user room for targeted notifications
      await client.join(`user:${userId}`);

      this.logger.log(`Authenticated socket ${client.id} for user ${userId} (${role})`);
    } catch (err) {
      this.logger.error(`Error in handleConnection: ${err}`);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Socket disconnected: ${client.id}`);
    await this.matchingService.handleTherapistDisconnect(client.id);
  }

  /**
   * Therapist toggles presence (Available / Offline)
   */
  @SubscribeMessage('therapist:presence')
  async handleTherapistPresence(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { isAvailable: boolean },
  ) {
    const userId = client.data.userId;
    if (!userId || client.data.role !== 'therapist') {
      return { error: 'Unauthorized — requires therapist role' };
    }

    if (payload.isAvailable) {
      await client.join('therapists:available');
    } else {
      await client.leave('therapists:available');
    }

    const presence = await this.matchingService.setTherapistPresence(
      userId,
      client.id,
      payload.isAvailable,
    );

    return { success: true, presence };
  }

  /**
   * Client initiates instant session matching request
   */
  @SubscribeMessage('session:request')
  async handleSessionRequest(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: ClientSessionRequestPayload,
  ) {
    const clientId = client.data.userId;
    const clientName = client.data.fullName || 'Client';

    if (!clientId) {
      return { error: 'Authentication required to request session' };
    }

    try {
      const { session, expiresAt } = await this.matchingService.createInstantSession(
        clientId,
        clientName,
        payload.type,
        payload.topic,
        (timeoutSessionId) => {
          // Timeout callback
          this.server.to(`user:${clientId}`).emit('session:timed_out', {
            sessionId: timeoutSessionId,
            message: 'No available therapists responded in time. You can try again or schedule in advance.',
          });
          this.server.to('therapists:available').emit('session:offer_expired', {
            sessionId: timeoutSessionId,
          });
        },
      );

      // Broadcast session offer to all currently available therapists
      const offerPayload: TherapistOfferPayload = {
        sessionId: session.id,
        clientId,
        clientName,
        type: payload.type as SessionType,
        languagePreference: payload.languagePreference,
        topic: payload.topic,
        expiresAt,
      };

      this.server.to('therapists:available').emit('session:offer', offerPayload);

      return {
        success: true,
        sessionId: session.id,
        expiresAt,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating session request';
      return { error: msg };
    }
  }

  /**
   * Therapist attempts to accept a session offer (first-to-accept race)
   */
  @SubscribeMessage('session:accept')
  async handleSessionAccept(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const therapistId = client.data.userId;
    if (!therapistId || client.data.role !== 'therapist') {
      return { error: 'Unauthorized — requires therapist account' };
    }

    const { won, sessionMatched, clientId } = await this.matchingService.acceptSession(
      therapistId,
      payload.sessionId,
    );

    if (!won || !sessionMatched || !clientId) {
      // Therapist lost the race
      return {
        success: false,
        message: 'This session has already been accepted by another therapist.',
      };
    }

    // 1. Notify the client that a match was found!
    this.server.to(`user:${clientId}`).emit('session:matched', sessionMatched);

    // 2. Notify the winning therapist
    client.emit('session:accepted', sessionMatched);

    // 3. Notify all other therapists to dismiss their incoming offer modal
    this.server.to('therapists:available').emit('session:offer_expired', {
      sessionId: payload.sessionId,
    });

    return { success: true, sessionMatched };
  }

  /**
   * Client cancels session request before a therapist accepts
   */
  @SubscribeMessage('session:cancel')
  async handleSessionCancel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { sessionId: string },
  ) {
    const clientId = client.data.userId;
    if (!clientId) return { error: 'Unauthorized' };

    const { cancelled } = await this.matchingService.cancelSession(clientId, payload.sessionId);

    if (cancelled) {
      // Dismiss offer on therapists
      this.server.to('therapists:available').emit('session:offer_expired', {
        sessionId: payload.sessionId,
      });
      client.emit('session:cancelled', { sessionId: payload.sessionId });
    }

    return { success: cancelled };
  }
}
