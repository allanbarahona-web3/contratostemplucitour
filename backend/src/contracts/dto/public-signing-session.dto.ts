import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class PublicSigningSessionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token!: string;
}
