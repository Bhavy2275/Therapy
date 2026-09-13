import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { VerifyTherapistDto } from './dto/verify-therapist.dto.js';
import { AdminTherapistFilterDto } from './dto/admin-filter.dto.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('therapists')
  @ApiOperation({ summary: 'List therapists in verification queue with optional status filter and counts' })
  getTherapists(@Query() filter: AdminTherapistFilterDto) {
    return this.adminService.getTherapists(filter);
  }

  @Get('therapists/:id')
  @ApiOperation({ summary: 'Get full details for a therapist, including user, credentials, and schedule' })
  getTherapistById(@Param('id') id: string) {
    return this.adminService.getTherapistById(id);
  }

  @Patch('therapists/:id/verify')
  @ApiOperation({ summary: 'Approve, reject, or suspend a therapist with admin review note' })
  verifyTherapist(
    @Param('id') id: string,
    @Body() body: VerifyTherapistDto,
  ) {
    return this.adminService.verifyTherapist(id, body);
  }
}
