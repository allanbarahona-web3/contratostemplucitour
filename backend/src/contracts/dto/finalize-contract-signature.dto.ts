import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class FinalizeContractSignatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  signedByName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
