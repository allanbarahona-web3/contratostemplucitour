import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import helmet from "helmet";
import { AppModule } from "./app.module";

const normalizeDatabaseUrl = () => {
  const raw = String(process.env.DATABASE_URL || "");
  const trimmed = raw.trim();
  if (!trimmed) {
    return;
  }

  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  // Some deployment UIs accidentally persist values like:
  // DATABASE_URL="postgresql://..."
  // We recover the first postgres URL to keep boot resilient.
  const recoveredMatch = unquoted.match(/postgres(?:ql)?:\/\/[^\s"']+/i);
  const normalized = recoveredMatch ? recoveredMatch[0].trim() : unquoted;

  process.env.DATABASE_URL = normalized;
};

const normalizeOrigin = (value: string) => String(value || "").trim().replace(/\/+$/, "");

const parseAllowedOrigins = (rawValue: string, publicAppBaseUrl: string) => {
  const value = String(rawValue || "").trim();
  const publicOrigin = normalizeOrigin(publicAppBaseUrl || "");

  if (!value || value === "*") {
    return {
      mode: "all" as const,
      list: new Set<string>(publicOrigin ? [publicOrigin] : []),
    };
  }

  const list = value
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean);

  if (publicOrigin) {
    list.push(publicOrigin);
  }

  return {
    mode: "list" as const,
    list: new Set<string>(list),
  };
};

async function bootstrap() {
  normalizeDatabaseUrl();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const allowedOrigins = parseAllowedOrigins(
    configService.get<string>("ALLOWED_ORIGIN", "*"),
    configService.get<string>("PUBLIC_APP_BASE_URL", ""),
  );

  // Accept larger JSON/form payloads for base64 PDF attachments.
  app.use(json({ limit: "20mb" }));
  app.use(urlencoded({ limit: "20mb", extended: true }));
  app.use(helmet());

  app.enableCors({
    origin: (origin, callback) => {
      // Requests without Origin (curl/postman/server-to-server) are allowed.
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);
      if (allowedOrigins.mode === "all" || allowedOrigins.list.has(normalized)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${normalized}`), false);
    },
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(configService.get<string>("PORT", "3001"));
  await app.listen(port);
  console.log(`[bootstrap] Server listening on port ${port}`);
}

bootstrap().catch((error) => {
  console.error("[bootstrap] FATAL - server failed to start:", error);
  process.exit(1);
});
