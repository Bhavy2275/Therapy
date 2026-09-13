import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { UpdateTherapistProfileDto } from './dto/update-therapist-profile.dto.js';
import type { AvailabilitySlotDto } from './dto/set-availability.dto.js';

@Injectable()
export class TherapistsService {
  private readonly logger = new Logger(TherapistsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getProfile(userId: string) {
    const { data: profile, error } = await this.supabase.client
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
      .eq('user_id', userId)
      .single();

    if (error || !profile) {
      this.logger.warn(`Therapist profile not found for user: ${userId}`);
      throw new NotFoundException('Therapist profile not found');
    }

    let licenseDocumentDownloadUrl: string | null = null;
    if (profile.license_document_url) {
      try {
        const { data: signed } = await this.supabase.client.storage
          .from('therapist-documents')
          .createSignedUrl(profile.license_document_url, 3600);
        licenseDocumentDownloadUrl = signed?.signedUrl ?? null;
      } catch (storageErr) {
        this.logger.warn(`Could not generate signed URL: ${storageErr}`);
      }
    }
    const userRecord = (Array.isArray(profile.users) ? profile.users[0] : profile.users) as {
      id: string;
      email: string;
      full_name: string;
      avatar_url?: string;
      timezone: string;
    };

    return {
      userId: profile.user_id,
      bio: profile.bio,
      licenseNumber: profile.license_number,
      licenseDocumentUrl: profile.license_document_url,
      licenseDocumentDownloadUrl,
      specializations: profile.specializations ?? [],
      languages: profile.languages ?? [],
      yearsOfExperience: profile.years_of_experience,
      status: profile.status,
      adminNote: profile.admin_note,
      isAvailableNow: profile.is_available_now,
      hourlyRateUsd: profile.hourly_rate_usd,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      user: {
        id: userRecord?.id ?? '',
        email: userRecord?.email ?? '',
        fullName: userRecord?.full_name ?? '',
        avatarUrl: userRecord?.avatar_url,
        timezone: userRecord?.timezone ?? 'UTC',
      },
    };
  }

  async updateProfile(userId: string, dto: UpdateTherapistProfileDto) {
    const updates: Record<string, unknown> = {};

    if (dto.bio !== undefined) updates.bio = dto.bio;
    if (dto.licenseNumber !== undefined) updates.license_number = dto.licenseNumber;
    if (dto.licenseDocumentUrl !== undefined) updates.license_document_url = dto.licenseDocumentUrl;
    if (dto.specializations !== undefined) updates.specializations = dto.specializations;
    if (dto.languages !== undefined) updates.languages = dto.languages;
    if (dto.yearsOfExperience !== undefined) updates.years_of_experience = dto.yearsOfExperience;
    if (dto.hourlyRateUsd !== undefined) updates.hourly_rate_usd = dto.hourlyRateUsd;

    // Fetch existing status
    const { data: current } = await this.supabase.client
      .from('therapist_profiles')
      .select('status')
      .eq('user_id', userId)
      .single();

    // If profile was rejected, updating license or bio resets status to 'pending' for re-review
    if (current?.status === 'rejected' && (dto.licenseNumber || dto.licenseDocumentUrl || dto.bio)) {
      updates.status = 'pending';
      updates.admin_note = null;
    }

    const { data, error } = await this.supabase.client
      .from('therapist_profiles')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update therapist profile: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return this.getProfile(userId);
  }

  async getAvailability(userId: string) {
    const { data, error } = await this.supabase.client
      .from('availability_slots')
      .select('id, day_of_week, start_time, end_time')
      .eq('therapist_id', userId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return (data || []).map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time.slice(0, 5),
      endTime: slot.end_time.slice(0, 5),
    }));
  }

  async setAvailability(userId: string, slots: AvailabilitySlotDto[]) {
    // Validate slot ranges
    for (const slot of slots) {
      if (slot.endTime <= slot.startTime) {
        throw new BadRequestException(
          `End time (${slot.endTime}) must be after start time (${slot.startTime})`,
        );
      }
    }

    // Check for overlaps on same day
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        if (a.dayOfWeek === b.dayOfWeek) {
          if (a.startTime < b.endTime && a.endTime > b.startTime) {
            throw new BadRequestException(
              `Overlapping slots detected on day ${a.dayOfWeek}: ${a.startTime}-${a.endTime} and ${b.startTime}-${b.endTime}`,
            );
          }
        }
      }
    }

    // Delete existing slots
    const { error: delError } = await this.supabase.client
      .from('availability_slots')
      .delete()
      .eq('therapist_id', userId);

    if (delError) {
      throw new BadRequestException(delError.message);
    }

    if (slots.length === 0) {
      return [];
    }

    // Insert new slots
    const rows = slots.map((s) => ({
      therapist_id: userId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
    }));

    const { data, error: insError } = await this.supabase.client
      .from('availability_slots')
      .insert(rows)
      .select('id, day_of_week, start_time, end_time')
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true });

    if (insError) {
      throw new BadRequestException(insError.message);
    }

    return (data || []).map((slot) => ({
      id: slot.id,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time.slice(0, 5),
      endTime: slot.end_time.slice(0, 5),
    }));
  }

  async createUploadSignedUrl(userId: string, filename: string) {
    const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${Date.now()}-${cleanName}`;

    const { data, error } = await this.supabase.client.storage
      .from('therapist-documents')
      .createSignedUploadUrl(storagePath);

    if (error) {
      this.logger.error(`Error creating upload signed URL: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return {
      storagePath,
      signedUrl: data?.signedUrl,
      token: data?.token,
    };
  }
}
