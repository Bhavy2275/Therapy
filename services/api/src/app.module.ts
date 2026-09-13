import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { HealthModule } from './health/health.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { TherapistsModule } from './therapists/therapists.module.js';
import { AdminModule } from './admin/admin.module.js';
import { MatchingModule } from './matching/matching.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { DonationsModule } from './donations/donations.module.js';

@Module({
  imports: [
    // Load env vars globally, no need to import ConfigModule in every module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    SupabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TherapistsModule,
    AdminModule,
    MatchingModule,
    SessionsModule,
    SchedulingModule,
    DonationsModule,
  ],
})

export class AppModule {}

