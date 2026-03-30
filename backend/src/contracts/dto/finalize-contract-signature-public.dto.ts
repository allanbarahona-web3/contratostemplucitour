import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class FinalizeContractSignaturePublicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  signedByName!: string;

  @IsString()
  @IsNotEmpty()
  signatureImageBase64!: string;
}
