import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { VerifyTherapistDto } from './dto/verify-therapist.dto.js';
import type { AdminTherapistFilterDto } from './dto/admin-filter.dto.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getTherapists(filter: AdminTherapistFilterDto) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = this.supabase.client
      .from('therapist_profiles')
      .select(`
        user_id,
        bio,
        license_number,
        license_document_url,
        specializations,
        languages,
        years_of_experience,
        status,
        admin_note,
        is_available_now,
        hourly_rate_usd,
        created_at,
        updated_at,
        users!inner (
          id,
          email,
          full_name,
          avatar_url,
          timezone
        )
      `, { count: 'exact' });

    if (filter.status) {
      query = query.eq('status', filter.status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data, count, error } = await query;

    if (error) {
      this.logger.error(`Failed to fetch therapists: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    // Also get status count summary for UI badges
    const { data: countsData } = await this.supabase.client
      .from('therapist_profiles')
      .select('status');

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
      total: 0,
    };

    if (countsData) {
      for (const row of countsData) {
        counts.total++;
        if (row.status in counts) {
          counts[row.status as keyof typeof counts]++;
        }
      }
    }

    // Enhance each record with signed download URL if document exists
    const therapists = await Promise.all(
      (data || []).map(async (p) => {
        let licenseDocumentDownloadUrl: string | null = null;
        if (p.license_document_url) {
          try {
            const { data: signed } = await this.supabase.client.storage
              .from('therapist-documents')
              .createSignedUrl(p.license_document_url, 3600);
            licenseDocumentDownloadUrl = signed?.signedUrl ?? null;
          } catch {
            // Document might be direct URL or storage unreachable
          }
        }

        const userRecord = (Array.isArray(p.users) ? p.users[0] : p.users) as {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string;
          timezone: string;
        };

        return {
          userId: p.user_id,
          bio: p.bio,
          licenseNumber: p.license_number,
          licenseDocumentUrl: p.license_document_url,
          licenseDocumentDownloadUrl,
          specializations: p.specializations ?? [],
          languages: p.languages ?? [],
          yearsOfExperience: p.years_of_experience,
          status: p.status,
          adminNote: p.admin_note,
          isAvailableNow: p.is_available_now,
          hourlyRateUsd: p.hourly_rate_usd,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          user: {
            id: userRecord?.id ?? '',
            email: userRecord?.email ?? '',
            fullName: userRecord?.full_name ?? '',
            avatarUrl: userRecord?.avatar_url,
            timezone: userRecord?.timezone ?? 'UTC',
          },
        };
      }),
    );

    return {
      data: therapists,
      total: count ?? 0,
      page,
      limit,
      counts,
    };
  }

  async getTherapistById(therapistId: string) {
    const { data: p, error } = await this.supabase.client
      .from('therapist_profiles')
      .select(`
        user_id,
        bio,
        license_number,
        license_document_url,
        specializations,
        languages,
        years_of_experience,
        status,
        admin_note,
        is_available_now,
        hourly_rate_usd,
        created_at,
        updated_at,
        users!inner (
          id,
          email,
          full_name,
          avatar_url,
          timezone
        )
      `)
      .eq('user_id', therapistId)
      .single();

    if (error || !p) {
      throw new NotFoundException(`Therapist ${therapistId} not found`);
    }

    let licenseDocumentDownloadUrl: string | null = null;
    if (p.license_document_url) {
      try {
        const { data: signed } = await this.supabase.client.storage
          .from('therapist-documents')
          .createSignedUrl(p.license_document_url, 3600);
        licenseDocumentDownloadUrl = signed?.signedUrl ?? null;
      } catch {
        // storage fallback
      }
    }

    // Also get their availability slots
    const { data: slots } = await this.supabase.client
      .from('availability_slots')
      .select('id, day_of_week, start_time, end_time')
      .eq('therapist_id', therapistId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    const userObj = (Array.isArray(p.users) ? p.users[0] : p.users) as {
      id?: string;
      email?: string;
      full_name?: string;
      avatar_url?: string;
      timezone?: string;
    } | undefined;

    return {
      userId: p.user_id,
      bio: p.bio,
      licenseNumber: p.license_number,
      licenseDocumentUrl: p.license_document_url,
      licenseDocumentDownloadUrl,
      specializations: p.specializations ?? [],
      languages: p.languages ?? [],
      yearsOfExperience: p.years_of_experience,
      status: p.status,
      adminNote: p.admin_note,
      isAvailableNow: p.is_available_now,
      hourlyRateUsd: p.hourly_rate_usd,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      user: {
        id: userObj?.id ?? '',
        email: userObj?.email ?? '',
        fullName: userObj?.full_name ?? '',
        avatarUrl: userObj?.avatar_url,
        timezone: userObj?.timezone ?? 'UTC',
      },
      availabilitySlots: (slots || []).map((s) => ({
        id: s.id,
        dayOfWeek: s.day_of_week,
        startTime: s.start_time.slice(0, 5),
        endTime: s.end_time.slice(0, 5),
      })),
    };
  }

  async verifyTherapist(therapistId: string, dto: VerifyTherapistDto) {
    const updates: Record<string, unknown> = {
      status: dto.status,
      admin_note: dto.adminNote ?? null,
    };

    // If rejecting or suspending, revoke live availability flag
    if (dto.status === 'rejected' || dto.status === 'suspended') {
      updates.is_available_now = false;
    }

    const { data, error } = await this.supabase.client
      .from('therapist_profiles')
      .update(updates)
      .eq('user_id', therapistId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to verify therapist: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return this.getTherapistById(therapistId);
  }
}
