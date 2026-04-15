import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsIn(["AGENT", "ADMIN", "agent", "admin"])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
