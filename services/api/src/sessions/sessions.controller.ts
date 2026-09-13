import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { SessionsService } from './sessions.service.js';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user sessions (past, active, upcoming)' })
  getMySessions(@Req() req: RequestWithUser) {
    return this.sessionsService.getUserSessions(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session details by ID' })
  getSessionById(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.sessionsService.getSessionById(req.user.id, id);
  }

  @Get(':id/livekit-token')
  @ApiOperation({ summary: 'Get LiveKit access token and room credentials for a session' })
  getLivekitToken(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.sessionsService.getLivekitToken(req.user.id, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or accepted session' })
  cancelSession(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.sessionsService.cancelSession(req.user.id, id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'Mark session as completed and record duration' })
  endSession(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return this.sessionsService.endSession(req.user.id, id);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Save therapist post-session clinical notes' })
  @ApiBody({ schema: { type: 'object', properties: { notes: { type: 'string' } }, required: ['notes'] } })
  saveSessionNotes(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.sessionsService.saveSessionNotes(req.user.id, id, notes);
  }
}

