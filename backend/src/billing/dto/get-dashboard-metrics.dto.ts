import { IsOptional, IsString } from "class-validator";

export class GetDashboardMetricsDto {
  @IsOptional()
  @IsString()
  period?: string; // "today" | "week" | "month" | "year"
}
