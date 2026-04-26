import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListBillingContractsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @IsIn(["FACTURA_EMITIDA", "FACTURA_PARCIAL", "FACTURA_PAGADA", "FACTURA_ANULADA"])
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(["7days", "1week", "2weeks", "1month", "3months"])
  datePreset?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
