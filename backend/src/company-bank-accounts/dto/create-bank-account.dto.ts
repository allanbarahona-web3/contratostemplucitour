import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class CreateBankAccountDto {
  @IsString()
  bankName!: string; // BAC, BCR, Promerica, etc.

  @IsString()
  accountNumber!: string; // Número de cuenta o IBAN

  @IsEnum(['CUENTA_CORRIENTE', 'CUENTA_AHORRO'])
  accountType!: string;

  @IsEnum(['CRC', 'USD'])
  currency!: string;

  @IsOptional()
  @IsString()
  sinpeNumber?: string; // Número SINPE móvil

  @IsString()
  accountHolderName!: string; // Nombre del titular

  @IsOptional()
  @IsString()
  companyName?: string; // Nombre comercial de la empresa

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
