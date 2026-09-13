import { IsNumber, IsOptional, IsString, Min, Max, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDonationCheckoutDto {
  @ApiProperty({ description: 'Donation amount in USD cents (e.g. 500 = $5.00)', example: 1500 })
  @IsNumber()
  @Min(100) // Minimum $1.00
  @Max(500000) // Maximum $5,000.00
  amountCents: number;

  @ApiPropertyOptional({ description: 'Optional logged-in user ID' })
  @IsOptional()
  @IsUUID()
  donorUserId?: string;

  @ApiPropertyOptional({ description: 'Optional donor message of encouragement' })
  @IsOptional()
  @IsString()
  donorMessage?: string;

  @ApiPropertyOptional({ description: 'Custom redirect URL after successful donation' })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({ description: 'Custom redirect URL if donor cancels' })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
