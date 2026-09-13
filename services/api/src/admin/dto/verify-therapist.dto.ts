import { IsIn, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyTherapistDto {
  @ApiProperty({ enum: ['approved', 'rejected', 'suspended'], example: 'approved' })
  @IsIn(['approved', 'rejected', 'suspended'])
  status: 'approved' | 'rejected' | 'suspended';

  @ApiPropertyOptional({ example: 'License verification completed successfully.' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
