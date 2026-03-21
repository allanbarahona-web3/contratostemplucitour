import { IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateSigningLinkDto {
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(10080)
  ttlMinutes?: number;
}
