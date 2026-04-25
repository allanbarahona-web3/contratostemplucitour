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
  @MaxLength(100)
  originBank?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  destinationBank?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  destinationAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Matches(/^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/, { 
    message: 'paymentReference debe ser un código alfanumérico de 6 caracteres (mínimo 1 letra y 1 número)' 
  })
  paymentReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  paymentDate?: string;
}
