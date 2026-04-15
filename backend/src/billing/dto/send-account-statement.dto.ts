import { IsEmail, IsOptional } from "class-validator";

export class SendAccountStatementDto {
  @IsOptional()
  @IsEmail()
  toEmail?: string;

  @IsOptional()
  @IsEmail()
  ccEmail?: string;
}
