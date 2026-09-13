import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class SchedulingService {
  private readonly logger = new Logger(SchedulingService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * List approved therapists with their profile details.
   * Supports optional text search and language / specialization filters.
   */
  async listApprovedTherapists(filters: {
    search?: string;
    language?: string;
    specialization?: string;
  }) {
    let query = this.supabase.client
      .from('therapist_profiles')
      .select(`
        user_id,
        bio,
        specializations,
        languages,
        years_of_experience,
        hourly_rate_usd,
        users!inner (
          id,
          full_name,
          email,
          avatar_url,
          timezone
        )
      `)
      .eq('status', 'approved');

    if (filters.search) {
      query = query.ilike('bio', `%${filters.search}%`);
    }
    if (filters.language) {
      query = query.contains('languages', [filters.language]);
    }
    if (filters.specialization) {
      query = query.contains('specializations', [filters.specialization]);
    }

    const { data, error } = await query.order('years_of_experience', { ascending: false });

    if (error) {
      this.logger.error(`Error fetching therapists: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return (data || []).map((row) => {
      const user = (Array.isArray(row.users) ? row.users[0] : row.users) as {
        id: string;
        full_name: string;
        email: string;
        avatar_url?: string;
        timezone: string;
      };
      return {
        therapistId: row.user_id,
        fullName: user.full_name,
        avatarUrl: user.avatar_url ?? null,
        timezone: user.timezone,
        bio: row.bio,
        specializations: row.specializations ?? [],
        languages: row.languages ?? [],
        yearsOfExperience: row.years_of_experience,
        hourlyRateUsd: row.hourly_rate_usd,
      };
    });
  }

  /**
   * Get a therapist's weekly availability slots.
   */
  async getTherapistAvailability(therapistId: string) {
    const { data, error } = await this.supabase.client
      .from('availability_slots')
      .select('id, day_of_week, start_time, end_time')
      .eq('therapist_id', therapistId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []).map((s) => ({
      id: s.id,
      dayOfWeek: s.day_of_week,
      startTime: s.start_time,
      endTime: s.end_time,
    }));
  }

  /**
   * Get all booked sessions for a therapist in a given week.
   */
  async getTherapistBookedSlots(therapistId: string, weekStart: string) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data, error } = await this.supabase.client
      .from('sessions')
      .select('scheduled_at, type, status')
      .eq('therapist_id', therapistId)
      .gte('scheduled_at', weekStart)
      .lt('scheduled_at', weekEnd.toISOString())
      .in('status', ['pending', 'accepted', 'in_progress']);

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []).map((s) => ({
      scheduledAt: s.scheduled_at,
      type: s.type,
      status: s.status,
    }));
  }

  /**
   * Book a scheduled session with a specific therapist.
   */
  async bookSession(dto: {
    clientId: string;
    therapistId: string;
    scheduledAt: string;
    sessionType: string;
  }) {
    if (new Date(dto.scheduledAt) <= new Date()) {
      throw new BadRequestException('Cannot book a session in the past');
    }

    const slotStart = new Date(dto.scheduledAt);
    const slotEnd = new Date(slotStart.getTime() + 45 * 60 * 1000);

    const { data: conflicts } = await this.supabase.client
      .from('sessions')
      .select('id')
      .eq('therapist_id', dto.therapistId)
      .gte('scheduled_at', slotStart.toISOString())
      .lt('scheduled_at', slotEnd.toISOString())
      .in('status', ['pending', 'accepted', 'in_progress']);

    if (conflicts && conflicts.length > 0) {
      throw new BadRequestException(
        'This time slot is already booked. Please choose another time.',
      );
    }

    const { data: session, error } = await this.supabase.client
      .from('sessions')
      .insert({
        client_id: dto.clientId,
        therapist_id: dto.therapistId,
        type: dto.sessionType,
        mode: 'scheduled',
        status: 'accepted',
        scheduled_at: dto.scheduledAt,
        billing_enabled: false,
      })
      .select()
      .single();

    if (error || !session) {
      throw new BadRequestException(
        `Could not create booking: ${error?.message ?? 'Unknown error'}`,
      );
    }

    return {
      success: true,
      sessionId: session.id,
      scheduledAt: session.scheduled_at,
      therapistId: dto.therapistId,
      message: 'Session booked successfully. You will see it in My Sessions.',
    };
  }

  /**
   * Cancel an upcoming scheduled session.
   * Only the booking client may cancel, and only if >2 hours remain.
   */
  async cancelBooking(sessionId: string, requestingUserId: string) {
    const { data: session, error: fetchErr } = await this.supabase.client
      .from('sessions')
      .select('id, client_id, scheduled_at, status')
      .eq('id', sessionId)
      .single();

    if (fetchErr || !session) {
      throw new NotFoundException('Session not found');
    }

    if (session.client_id !== requestingUserId) {
      throw new ForbiddenException('You can only cancel your own sessions');
    }

    if (!['pending', 'accepted'].includes(session.status)) {
      throw new BadRequestException(
        `Cannot cancel a session with status "${session.status}"`,
      );
    }

    const scheduledAt = new Date(session.scheduled_at);
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    if (scheduledAt <= twoHoursFromNow) {
      throw new BadRequestException(
        'Sessions can only be cancelled more than 2 hours before the scheduled time',
      );
    }

    const { error: updateErr } = await this.supabase.client
      .from('sessions')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);

    if (updateErr) {
      throw new BadRequestException(`Could not cancel session: ${updateErr.message}`);
    }

    return { success: true, message: 'Session cancelled successfully' };
  }
}
