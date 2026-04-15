import { IsOptional, IsString, MaxLength } from "class-validator";

export class ApplyCreditNoteDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
