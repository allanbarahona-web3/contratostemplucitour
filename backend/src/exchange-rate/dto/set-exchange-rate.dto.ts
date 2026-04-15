import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class SetExchangeRateDto {
  @IsNotEmpty()
  @IsString()
  date!: string; // Format: YYYY-MM-DD

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  buyRate!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  sellRate!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
