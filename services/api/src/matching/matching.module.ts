import { Module } from '@nestjs/common';
import { MatchingGateway } from './matching.gateway.js';
import { MatchingService } from './matching.service.js';

@Module({
  providers: [MatchingGateway, MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
