import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class RejectCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
