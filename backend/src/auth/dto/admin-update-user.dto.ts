import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsIn(["AGENT", "ADMIN", "CONTADOR", "FACTURACION_COBROS", "agent", "admin", "contador", "facturacion_cobros"])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
