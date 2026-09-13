import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { TherapistsService } from './therapists.service.js';
import { UpdateTherapistProfileDto } from './dto/update-therapist-profile.dto.js';
import { SetAvailabilityDto } from './dto/set-availability.dto.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';

interface RequestWithUser {
  user: { id: string };
}

@ApiTags('therapists')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('therapist')
@Controller('therapists')
export class TherapistsController {
  constructor(private readonly therapistsService: TherapistsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current therapist profile, verification status, and details' })
  getMe(@Req() req: RequestWithUser) {
    return this.therapistsService.getProfile(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update therapist profile and license details' })
  updateMe(
    @Req() req: RequestWithUser,
    @Body() body: UpdateTherapistProfileDto,
  ) {
    return this.therapistsService.updateProfile(req.user.id, body);
  }

  @Get('me/availability')
  @ApiOperation({ summary: 'Get recurring weekly availability slots' })
  getAvailability(@Req() req: RequestWithUser) {
    return this.therapistsService.getAvailability(req.user.id);
  }

  @Put('me/availability')
  @ApiOperation({ summary: 'Set recurring weekly availability schedule' })
  setAvailability(
    @Req() req: RequestWithUser,
    @Body() body: SetAvailabilityDto,
  ) {
    return this.therapistsService.setAvailability(req.user.id, body.slots);
  }

  @Post('me/upload-url')
  @ApiOperation({ summary: 'Get presigned upload URL for therapist license/verification document' })
  @ApiBody({ schema: { properties: { filename: { type: 'string', example: 'license.pdf' } } } })
  createUploadUrl(
    @Req() req: RequestWithUser,
    @Body('filename') filename: string,
  ) {
    return this.therapistsService.createUploadSignedUrl(req.user.id, filename || 'license.pdf');
  }
}
