import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class UpdateBankAccountDto {
  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsEnum(['CUENTA_CORRIENTE', 'CUENTA_AHORRO'])
  accountType?: string;

  @IsOptional()
  @IsEnum(['CRC', 'USD'])
  currency?: string;

  @IsOptional()
  @IsString()
  sinpeNumber?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
