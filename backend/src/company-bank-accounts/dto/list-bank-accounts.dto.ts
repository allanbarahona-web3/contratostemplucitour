import { IsOptional, IsEnum, IsString } from 'class-validator';

export class ListBankAccountsDto {
  @IsOptional()
  @IsString()
  bankName?: string; // Filtrar por banco

  @IsOptional()
  @IsEnum(['CRC', 'USD'])
  currency?: string; // Filtrar por moneda

  @IsOptional()
  @IsEnum(['true', 'false', 'all'])
  isActive?: string; // Filtrar por activas/inactivas/todas
}
