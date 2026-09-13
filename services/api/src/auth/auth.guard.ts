import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service.js';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * SupabaseAuthGuard verifies the Bearer JWT in the Authorization header
 * against Supabase. Attaches the decoded user to request.user.
 *
 * Mark routes public with @Public() decorator to skip this guard.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseAuthGuard.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: unknown;
    }>();

    const token = this.extractToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException('Missing authorization token');

    const { data, error } = await this.supabase.client.auth.getUser(token);
    if (error || !data.user) {
      this.logger.warn(`Auth failed: ${error?.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = data.user;
    return true;
  }

  private extractToken(authHeader?: string): string | null {
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  }
}

import { SetMetadata } from '@nestjs/common';
/** Mark a route as public — skips SupabaseAuthGuard */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
