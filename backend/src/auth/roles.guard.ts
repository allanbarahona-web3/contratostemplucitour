import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const userRole = String(req.user?.role || "").trim().toUpperCase();

    if (!userRole || !requiredRoles.map((role) => role.toUpperCase()).includes(userRole)) {
      throw new ForbiddenException("No tienes permisos para esta accion.");
    }

    return true;
  }
}
