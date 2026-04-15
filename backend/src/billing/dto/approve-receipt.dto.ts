import { IsEmail, IsOptional } from "class-validator";

export class ApproveReceiptDto {
  @IsOptional()
  @IsEmail()
  toEmail?: string;

  @IsOptional()
  @IsEmail()
  ccEmail?: string;
}
