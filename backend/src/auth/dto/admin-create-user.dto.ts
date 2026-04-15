import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class AdminCreateUserDto {
  @IsString()
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @IsIn(["AGENT", "ADMIN", "agent", "admin"])
  role?: string;
}
