import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { SchedulingService } from './scheduling.service.js';
import { Public } from '../auth/auth.guard.js';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('scheduling')
@Controller('scheduling')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Get('therapists')
  @Public()
  @ApiOperation({ summary: 'Browse approved therapists with optional filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'language', required: false })
  @ApiQuery({ name: 'specialization', required: false })
  listTherapists(
    @Query('search') search?: string,
    @Query('language') language?: string,
    @Query('specialization') specialization?: string,
  ) {
    return this.schedulingService.listApprovedTherapists({
      search,
      language,
      specialization,
    });
  }

  @Get('therapists/:therapistId/availability')
  @Public()
  @ApiOperation({ summary: 'Get therapist weekly availability slots' })
  getAvailability(@Param('therapistId') therapistId: string) {
    return this.schedulingService.getTherapistAvailability(therapistId);
  }

  @Get('therapists/:therapistId/booked')
  @Public()
  @ApiOperation({ summary: 'Get booked sessions for a therapist in a given week' })
  @ApiQuery({ name: 'weekStart', required: true, description: 'ISO 8601 date string for the week start (Monday)' })
  getBookedSlots(
    @Param('therapistId') therapistId: string,
    @Query('weekStart') weekStart: string,
  ) {
    return this.schedulingService.getTherapistBookedSlots(therapistId, weekStart);
  }

  @Post('book')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Book a scheduled session with a therapist' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['therapistId', 'scheduledAt', 'sessionType'],
      properties: {
        therapistId: { type: 'string', format: 'uuid' },
        scheduledAt: { type: 'string', format: 'date-time' },
        sessionType: { type: 'string', enum: ['video', 'voice', 'chat'] },
      },
    },
  })
  bookSession(
    @Req() req: RequestWithUser,
    @Body('therapistId') therapistId: string,
    @Body('scheduledAt') scheduledAt: string,
    @Body('sessionType') sessionType: string,
  ) {
    return this.schedulingService.bookSession({
      clientId: req.user.id,
      therapistId,
      scheduledAt,
      sessionType,
    });
  }
  @Delete('bookings/:sessionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel an upcoming scheduled session (client only, >2h buffer)' })
  cancelBooking(
    @Req() req: RequestWithUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.schedulingService.cancelBooking(sessionId, req.user.id);
  }
}
