import { Module } from '@nestjs/common';
import { TherapistsController } from './therapists.controller.js';
import { TherapistsService } from './therapists.service.js';

@Module({
  controllers: [TherapistsController],
  providers: [TherapistsService],
  exports: [TherapistsService],
})
export class TherapistsModule {}
