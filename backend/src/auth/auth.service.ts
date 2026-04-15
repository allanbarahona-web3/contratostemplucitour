import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { AdminCreateUserDto } from "./dto/admin-create-user.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";

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
    const role = String(dto.role || "AGENT").trim().toUpperCase() === "ADMIN" ? "ADMIN" : "AGENT";

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

  async adminUpdateUser(userId: string, dto: AdminUpdateUserDto) {
    const data: Record<string, unknown> = {};

    if (typeof dto.fullName === "string") {
      data.fullName = dto.fullName.trim();
    }

    if (typeof dto.role === "string") {
      data.role = String(dto.role).trim().toUpperCase() === "ADMIN" ? "ADMIN" : "AGENT";
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
}
