import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { RegisterDto, LoginDto, RefreshDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async register(dto: RegisterDto) {
    // Sign up via Supabase Auth — triggers handle_new_user() in Postgres
    const { data, error } = await this.supabase.client.auth.signUp({
      email: dto.email,
      password: dto.password,
      options: {
        data: {
          full_name: dto.fullName,
          role: dto.role,
          timezone: dto.timezone,
        },
      },
    });

    if (error) {
      this.logger.warn(`Register failed for ${dto.email}: ${error.message}`);
      if (error.message.toLowerCase().includes('already registered')) {
        throw new ConflictException('Email already in use');
      }
      throw new InternalServerErrorException(error.message);
    }

    return {
      user: data.user,
      session: data.session,
    };
  }

  async login(dto: LoginDto) {
    const { data, error } =
      await this.supabase.client.auth.signInWithPassword({
        email: dto.email,
        password: dto.password,
      });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Fetch public user row to include role
    const { data: userRow } = await this.supabase.client
      .from('users')
      .select('id, email, role, full_name, avatar_url, timezone')
      .eq('id', data.user.id)
      .single();

    return {
      user: userRow,
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async refresh(dto: RefreshDto) {
    const { data, error } = await this.supabase.client.auth.refreshSession({
      refresh_token: dto.refreshToken,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    };
  }

  async logout(accessToken: string) {
    const userClient = this.supabase.getUserClient(accessToken);
    await userClient.auth.signOut();
    return { message: 'Logged out successfully' };
  }
}
