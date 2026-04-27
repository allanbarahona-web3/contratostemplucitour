import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { randomUUID, randomBytes } from "crypto";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { AdminCreateUserDto } from "./dto/admin-create-user.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ConfirmPasswordResetDto } from "./dto/confirm-password-reset.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";

type JwtSessionPayload = {
  sub: string;
  email: string;
  jti?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const honeypot = (dto.website || "").trim();
    if (honeypot) {
      throw new UnauthorizedException("Credenciales invalidas");
    }

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException("Credenciales invalidas");
    }

    if (!user.isActive) {
      throw new UnauthorizedException("Tu usuario ha sido suspendido. Contacta al administrador.");
    }

    const validPassword = await compare(dto.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException("Credenciales invalidas");
    }

    const tokenId = randomUUID();

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        activeJti: tokenId,
        activeAt: new Date(),
      },
    });

    const token = await this.jwtService.signAsync(
      {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      },
      { jwtid: tokenId },
    );

    return {
      accessToken: token,
      jti: tokenId,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        mustChangePassword: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Sesion invalida");
    }

    return user;
  }

  async checkTokenSessionState(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtSessionPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          isActive: true,
          activeJti: true,
        },
      });

      const isValid = Boolean(
        payload.jti && user && user.isActive && user.activeJti && payload.jti === user.activeJti,
      );

      return {
        isValid,
        userId: payload.sub,
      };
    } catch {
      return {
        isValid: false,
        userId: null,
      };
    }
  }

  async adminListUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        activeAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return users;
  }

  async adminCreateUser(dto: AdminCreateUserDto) {
    const email = String(dto.email || "").trim().toLowerCase();
    const fullName = String(dto.fullName || "").trim();
    const password = String(dto.password || "");
    const roleInput = String(dto.role || "AGENT").trim().toUpperCase();
    const role = ["ADMIN", "CONTADOR", "FACTURACION_COBROS", "VENTAS", "OPERACIONES"].includes(roleInput) ? roleInput : "AGENT";

    const passwordHash = await hash(password, 10);

    const created = await this.prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        role,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return created;
  }

  async adminUpdateUser(userId: string, dto: AdminUpdateUserDto, currentUserId: string) {
    // Rule 1: User cannot suspend themselves
    if (typeof dto.isActive === "boolean" && !dto.isActive && userId === currentUserId) {
      throw new BadRequestException("No puedes suspenderte a ti mismo.");
    }

    // Rule 2: Cannot suspend the last active ADMIN
    if (typeof dto.isActive === "boolean" && !dto.isActive) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true },
      });

      if (targetUser?.role === "ADMIN" && targetUser.isActive) {
        // Count active admins
        const activeAdminCount = await this.prisma.user.count({
          where: {
            role: "ADMIN",
            isActive: true,
          },
        });

        // If this is the last active admin, prevent suspension
        if (activeAdminCount <= 1) {
          throw new BadRequestException(
            "No se puede suspender al único administrador activo del sistema. Activa otro administrador primero.",
          );
        }
      }
    }

    const data: Record<string, unknown> = {};

    if (typeof dto.role === "string") {
      const roleInput = String(dto.role).trim().toUpperCase();
      data.role = ["ADMIN", "CONTADOR", "FACTURACION_COBROS", "VENTAS", "OPERACIONES"].includes(roleInput) ? roleInput : "AGENT";
      // Invalidate session when role changes - forces re-login with new permissions
      data.activeJti = null;
    }

    if (typeof dto.fullName === "string") {
      data.fullName = dto.fullName.trim();
    }

    if (typeof dto.email === "string") {
      const newEmail = dto.email.trim().toLowerCase();
      
      // Check if email is already taken by another user
      const existingUser = await this.prisma.user.findUnique({
        where: { email: newEmail },
        select: { id: true },
      });

      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException("Este correo ya está registrado por otro usuario.");
      }

      data.email = newEmail;
      // Invalidate session when email changes - forces re-login with new credentials
      data.activeJti = null;
    }

    if (typeof dto.isActive === "boolean") {
      data.isActive = dto.isActive;
      if (!dto.isActive) {
        data.activeJti = null;
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        activeAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return updated;
  }

  /**
   * Request a password reset token
   * Always returns success to avoid email enumeration attacks
   */
  async requestPasswordReset(dto: RequestPasswordResetDto) {
    // Check honeypot
    const honeypot = (dto.website || "").trim();
    if (honeypot) {
      // Pretend success but don't actually send email
      return { ok: true, message: "Si el correo existe, recibirás un enlace para resetear tu contraseña." };
    }

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return success message to prevent email enumeration
    if (!user || !user.isActive) {
      return { ok: true, message: "Si el correo existe, recibirás un enlace para resetear tu contraseña." };
    }

    // Generate secure random token (64 characters hex)
    const token = randomBytes(32).toString("hex");
    
    // Token expires in 5 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Invalidate all previous tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    // Create new reset token
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // Send password reset email
    try {
      await this.sendPasswordResetEmail(user.email, user.fullName, token);
      this.logger.log(`[PASSWORD RESET] Email sent to ${user.email}`);
    } catch (emailError) {
      this.logger.error(`[PASSWORD RESET] Failed to send email to ${user.email}:`, emailError);
      // Don't throw error to avoid revealing if email exists
    }

    return { ok: true, message: "Si el correo existe, recibirás un enlace para resetear tu contraseña." };
  }

  /**
   * Reset password using valid token
   */
  async confirmPasswordReset(dto: ConfirmPasswordResetDto) {
    this.logger.log(`[PASSWORD RESET CONFIRM] Attempting with token length: ${dto.token?.length || 0}`);
    
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: { user: true },
    });

    if (!resetToken) {
      this.logger.warn(`[PASSWORD RESET CONFIRM] Token not found in database`);
      throw new BadRequestException("Token inválido o expirado");
    }

    this.logger.log(`[PASSWORD RESET CONFIRM] Token found for user: ${resetToken.user.email}`);

    // Check if token is already used
    if (resetToken.usedAt) {
      this.logger.warn(`[PASSWORD RESET CONFIRM] Token already used at: ${resetToken.usedAt}`);
      throw new BadRequestException("Este token ya fue utilizado");
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      this.logger.warn(`[PASSWORD RESET CONFIRM] Token expired at: ${resetToken.expiresAt}`);
      throw new BadRequestException("Token expirado. Solicita un nuevo enlace de reseteo");
    }

    // Check if user is active
    if (!resetToken.user.isActive) {
      this.logger.warn(`[PASSWORD RESET CONFIRM] User is inactive`);
      throw new BadRequestException("Usuario inactivo");
    }

    this.logger.log(`[PASSWORD RESET CONFIRM] All validations passed, updating password for: ${resetToken.user.email}`);

    // Hash new password
    const passwordHash = await hash(dto.newPassword, 10);

    // Update password and mark token as used
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          activeJti: null, // Invalidate current session
          mustChangePassword: false, // User voluntarily reset their password
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: {
          usedAt: new Date(),
        },
      }),
    ]);

    this.logger.log(`[PASSWORD RESET CONFIRM] Password successfully updated for: ${resetToken.user.email}`);

    return { ok: true, message: "Contraseña actualizada correctamente. Ahora puedes iniciar sesión." };
  }

  /**
   * Generate a secure random password
   * 8 characters: mix of uppercase, lowercase, numbers
   */
  private generateTemporaryPassword(): string {
    const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // Removed I, O
    const lowercase = "abcdefghjkmnpqrstuvwxyz"; // Removed i, l, o
    const numbers = "23456789"; // Removed 0, 1
    const allChars = uppercase + lowercase + numbers;

    let password = "";
    
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    
    // Fill the rest randomly
    for (let i = 3; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Admin resets a user's password to a temporary one
   * User must change password on next login
   */
  async adminResetUserPassword(dto: AdminResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    // Generate temporary password
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await hash(temporaryPassword, 10);

    // Update user: new password + must change flag + invalidate session
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        activeJti: null, // Force re-login
      },
    });

    // TODO: Send email with temporary password
    // For now, return it in the response (admin will communicate it manually)
    console.log(`[PASSWORD RESET] User: ${user.email}, Temporary Password: ${temporaryPassword}`);

    return {
      ok: true,
      message: `Contraseña temporal generada para ${user.fullName}`,
      temporaryPassword,
      email: user.email,
      fullName: user.fullName,
    };
  }

  /**
   * User changes their own password (when mustChangePassword=true or voluntary)
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        mustChangePassword: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Usuario no válido");
    }

    // Verify current password
    const validPassword = await compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new BadRequestException("Contraseña actual incorrecta");
    }

    // Hash new password
    const passwordHash = await hash(newPassword, 10);

    // Update password and clear mustChangePassword flag
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return { ok: true, message: "Contraseña actualizada correctamente" };
  }

  /**
   * Send password reset email using Resend
   */
  private async sendPasswordResetEmail(email: string, fullName: string, token: string) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY", "").trim();
    const fromEmail = this.configService.get<string>("AUTH_FROM_EMAIL", "").trim();
    const frontendUrl = this.configService.get<string>("FRONTEND_URL", "http://localhost:3000").trim();

    if (!apiKey || !fromEmail) {
      throw new InternalServerErrorException("Falta configurar RESEND_API_KEY o AUTH_FROM_EMAIL.");
    }

    const resetLink = `${frontendUrl}/reset-password?token=${token}`;
    const resend = new Resend(apiKey);

    await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: "🔐 Restablece tu contraseña - Viajes Alma Nova",
      html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; line-height: 1.6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                Viajes Alma Nova
              </h1>
              <p style="margin: 8px 0 0 0; color: #e9d5ff; font-size: 14px; font-weight: 500;">
                Experiencias inolvidables, destinos únicos
              </p>
            </td>
          </tr>

          <!-- Icon Badge -->
          <tr>
            <td style="padding: 30px 30px 0 30px; text-align: center;">
              <div style="display: inline-block; background-color: #f59e0b; color: #ffffff; width: 80px; height: 80px; border-radius: 50%; line-height: 80px; font-size: 40px; margin-bottom: 10px;">
                🔐
              </div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 30px;">
              <h2 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: 600; text-align: center;">
                Restablece tu contraseña
              </h2>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Hola <strong>${fullName}</strong>,
              </p>

              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú, haz clic en el botón de abajo para crear una nueva contraseña.
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" 
                   style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);">
                  Restablecer Contraseña
                </a>
              </div>

              <!-- Alternative Link -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">
                  Si el botón no funciona, copia y pega este enlace en tu navegador:
                </p>
                <p style="margin: 0; word-break: break-all;">
                  <a href="${resetLink}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">${resetLink}</a>
                </p>
              </div>

              <!-- Warning -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                  <strong>⚠️ Importante:</strong> Este enlace expirará en <strong>5 minutos</strong>. Si no solicitaste este cambio, ignora este correo y tu contraseña permanecerá igual.
                </p>
              </div>

              <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Por tu seguridad, nunca compartas este enlace con nadie.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 13px;">
                Este es un correo automático, por favor no respondas.
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 13px;">
                © ${new Date().getFullYear()} <strong style="color: #764ba2;">Viajes Alma Nova</strong> - Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });
  }
}
