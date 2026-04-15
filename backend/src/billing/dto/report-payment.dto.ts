import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class ReportPaymentDto {
  @IsString()
  @IsIn(["RESERVATION", "INSTALLMENT", "OTHER"])
  type: "RESERVATION" | "INSTALLMENT" | "OTHER" = "OTHER";

  @IsString()
  @IsNotEmpty()
  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  bankReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  payerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paymentDate?: string;
}
