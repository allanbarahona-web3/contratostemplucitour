import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class SaveContractDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contractNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientFullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clientIdNumber?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  destination?: string;

  @IsString()
  @IsNotEmpty()
  payloadJson!: string;
}