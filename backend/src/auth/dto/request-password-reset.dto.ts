import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestPasswordResetDto {
  @IsEmail()
  email!: string;

  // Honeypot field
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
