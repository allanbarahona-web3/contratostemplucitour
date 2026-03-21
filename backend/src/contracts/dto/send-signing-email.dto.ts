import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SendSigningEmailDto {
  @IsEmail()
  toEmail!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clientName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contractNumber!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  signingUrl!: string;
}
