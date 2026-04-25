import { IsString, Matches, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  @Matches(/^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/`~])/, {
    message: "La contraseña debe incluir al menos una letra mayúscula y un carácter especial (!@#$%&*...)"
  })
  newPassword!: string;
}
