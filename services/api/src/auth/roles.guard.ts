import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../supabase/supabase.service.js';
import type { UserRole } from '@therapy/shared-types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: string; user_metadata?: { role?: UserRole } };
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    // Check user_metadata first for performance
    let userRole = user.user_metadata?.role;

    // If role is missing from metadata, query public.users table
    if (!userRole) {
      const { data } = await this.supabase.client
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      userRole = data?.role;
    }

    if (!userRole || !requiredRoles.includes(userRole as UserRole)) {
      throw new ForbiddenException(
        `Requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
