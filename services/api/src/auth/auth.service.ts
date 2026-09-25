import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { RegisterDto, LoginDto, RefreshDto, VerifyCodeDto, ResendCodeDto } from './auth.dto.js';

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

    // Guard: if no public profile exists the account was deleted.
    // Immediately revoke the Supabase session so the credential is invalidated.
    if (!userRow) {
      this.logger.warn(`Login blocked — no public profile for auth user ${data.user.id} (${dto.email}). Account was likely deleted.`);
      await this.supabase.client.auth.signOut();
      throw new UnauthorizedException('Account not found. Please contact support.');
    }

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

  async verifyCode(dto: VerifyCodeDto) {
    let { data, error } = await this.supabase.client.auth.verifyOtp({
      email: dto.email,
      token: dto.code,
      type: 'signup',
    });

    if (error) {
      const fallback = await this.supabase.client.auth.verifyOtp({
        email: dto.email,
        token: dto.code,
        type: 'email',
      });
      if (!fallback.error && fallback.data.session) {
        data = fallback.data;
        error = null;
      }
    }

    if (error || !data.session) {
      this.logger.warn(`Verify code failed for ${dto.email}: ${error?.message}`);
      throw new UnauthorizedException(error?.message || 'Invalid or expired verification code');
    }

    const { data: userRow } = await this.supabase.client
      .from('users')
      .select('id, email, role, full_name, avatar_url, timezone')
      .eq('id', data.user!.id)
      .single();

    // Guard: deleted accounts have no public profile
    if (!userRow) {
      this.logger.warn(`Verify code blocked — no public profile for auth user ${data.user!.id} (${dto.email}). Account was likely deleted.`);
      await this.supabase.client.auth.signOut();
      throw new UnauthorizedException('Account not found. Please contact support.');
    }

    return {
      user: userRow,
      accessToken: data.session!.access_token,
      refreshToken: data.session!.refresh_token,
    };
  }

  async resendCode(dto: ResendCodeDto) {
    // Guard: only resend to accounts that exist in public.users
    const { data: userRow } = await this.supabase.client
      .from('users')
      .select('id')
      .eq('email', dto.email)
      .single();

    if (!userRow) {
      // Don't reveal whether the account exists — return success to prevent enumeration
      return { message: 'Verification code resent successfully' };
    }

    const { error } = await this.supabase.client.auth.resend({
      type: 'signup',
      email: dto.email,
    });

    if (error) {
      this.logger.warn(`Resend code failed for ${dto.email}: ${error.message}`);
      throw new BadRequestException(error.message);
    }

    return { message: 'Verification code resent successfully' };
  }
}

