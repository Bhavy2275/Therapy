import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getMe(userId: string) {
    const { data: user, error } = await this.supabase.client
      .from('users')
      .select(`
        id, email, role, full_name, avatar_url, timezone, created_at, updated_at,
        therapist_profiles ( bio, license_number, specializations, languages, years_of_experience, status, is_available_now, hourly_rate_usd ),
        client_profiles ( preferred_languages, preferred_therapist_gender )
      `)
      .eq('id', userId)
      .single();

    if (error || !user) {
      this.logger.warn(`User not found: ${userId}`);
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, updates: Partial<{ fullName: string; timezone: string; avatarUrl: string }>) {
    const mapped: Record<string, unknown> = {};
    if (updates.fullName) mapped.full_name = updates.fullName;
    if (updates.timezone) mapped.timezone = updates.timezone;
    if (updates.avatarUrl) mapped.avatar_url = updates.avatarUrl;

    const { data, error } = await this.supabase.client
      .from('users')
      .update(mapped)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }
}
