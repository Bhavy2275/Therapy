import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SupabaseAuthGuard } from './auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    // Apply SupabaseAuthGuard globally — routes opt-out via @Public()
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
