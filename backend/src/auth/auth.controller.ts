import { Body, Controller, Get, MessageEvent, Param, Patch, Post, Query, Req, Sse, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { Observable } from "rxjs";
import { RolesGuard } from "./roles.guard";
import { Roles } from "./roles.decorator";
import { AdminCreateUserDto } from "./dto/admin-create-user.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: { user: { id: string } }) {
    return this.authService.me(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get("verify")
  verify(@Req() req: { user: { id: string } }) {
    return this.authService.me(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Get("users")
  adminUsers() {
    return this.authService.adminListUsers();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Post("users")
  adminCreateUser(@Body() dto: AdminCreateUserDto) {
    return this.authService.adminCreateUser(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  @Patch("users/:userId")
  adminUpdateUser(@Param("userId") userId: string, @Body() dto: AdminUpdateUserDto) {
    return this.authService.adminUpdateUser(userId, dto);
  }

  @Sse("session-stream")
  sessionStream(@Query("token") token = ""): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const streamToken = String(token || "").trim();

      if (!streamToken) {
        subscriber.next({
          type: "session-invalid",
          data: { reason: "missing-token" },
        });
        subscriber.complete();
        return;
      }

      const emitState = async () => {
        const state = await this.authService.checkTokenSessionState(streamToken);

        if (!state.isValid) {
          subscriber.next({
            type: "session-replaced",
            data: { reason: "session-replaced" },
          });
          subscriber.complete();
          return;
        }

        subscriber.next({
          type: "heartbeat",
          data: { ok: true, userId: state.userId },
        });
      };

      void emitState();
      const timer = setInterval(() => {
        void emitState();
      }, 1000);

      return () => {
        clearInterval(timer);
      };
    });
  }
}
