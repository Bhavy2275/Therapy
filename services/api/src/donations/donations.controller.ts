import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/auth.guard.js';
import { DonationsService } from './donations.service.js';
import { CreateDonationCheckoutDto } from './dto/create-checkout.dto.js';


@ApiTags('donations')
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post('checkout')
  @Public()
  @ApiOperation({ summary: 'Initiate a voluntary Stripe donation checkout session' })
  @ApiResponse({ status: 201, description: 'Checkout URL returned' })
  async createCheckout(@Body() dto: CreateDonationCheckoutDto) {
    return this.donationsService.createCheckoutSession(dto);
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Stripe webhook receiver for asynchronous payment events' })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body for webhook validation');
    }

    return this.donationsService.handleWebhook(rawBody, signature);
  }

  @Get('stats')
  @Public()
  @ApiOperation({ summary: 'Get transparent platform donation metrics' })
  async getStats() {
    return this.donationsService.getDonationStats();
  }
}
