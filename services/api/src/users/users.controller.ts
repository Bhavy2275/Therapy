import { Controller, Get, Patch, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';

interface RequestWithUser extends Request {
  user: { id: string };
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile with role-specific data' })
  getMe(@Req() req: RequestWithUser) {
    return this.usersService.getMe(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user basic info' })
  updateMe(
    @Req() req: RequestWithUser,
    @Body() body: { fullName?: string; timezone?: string; avatarUrl?: string },
  ) {
    return this.usersService.updateMe(req.user.id, body);
  }
}
