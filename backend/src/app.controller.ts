import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  root() {
    return { status: "ok", service: "contratos-temp-backend" };
  }

  @Get("health")
  health() {
    return { status: "ok" };
  }
}