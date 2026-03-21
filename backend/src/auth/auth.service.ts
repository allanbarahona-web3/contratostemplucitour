import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";

type JwtSessionPayload = {
  sub: string;
  email: string;
  jti?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const honeypot = (dto.website || "").trim();
    if (honeypot) {
      throw new UnauthorizedException("Credenciales invalidas");
    }

    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Credenciales invalidas");
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
}
