import { IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  sourceDocumentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceDocumentId?: string;
}
