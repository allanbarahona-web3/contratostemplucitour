import { Controller, Get } from "@nestjs/common";

const BUILD_TIME = new Date().toISOString();

@Controller()
export class AppController {
  @Get()
  root() {
    return { status: "ok", service: "contratos-temp-backend", buildTime: BUILD_TIME };
  }

  @Get("health")
  health() {
    return { status: "ok", buildTime: BUILD_TIME };
  }
}