import { IsString } from "class-validator";

export class AdminResetPasswordDto {
  @IsString()
  userId!: string;
}
