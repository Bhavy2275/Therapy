import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * SupabaseService provides a service-role Supabase client for server-side
 * operations (bypasses RLS). Never expose this client to the frontend.
 *
 * For user-scoped operations (respecting RLS), use the user's JWT directly
 * with a separate client created via createClient with the user's access token.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private _client: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url =
      this.config.get<string>('SUPABASE_URL') ||
      this.config.getOrThrow<string>('NEXT_PUBLIC_SUPABASE_URL');
    const serviceKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    this._client = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase service-role client initialized');
  }

  /** Service-role client — bypasses RLS. Use carefully. */
  get client(): SupabaseClient {
    return this._client;
  }

  /**
   * Create a user-scoped client that respects RLS.
   * Pass the user's Supabase access token (JWT).
   */
  getUserClient(accessToken: string): SupabaseClient {
    const url =
      this.config.get<string>('SUPABASE_URL') ||
      this.config.getOrThrow<string>('NEXT_PUBLIC_SUPABASE_URL');
    const anonKey =
      this.config.get<string>('SUPABASE_ANON_KEY') ||
      this.config.getOrThrow<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY');

    return createClient(url, anonKey, {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
