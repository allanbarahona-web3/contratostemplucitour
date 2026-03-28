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

const parseAllowedOrigins = (rawValue: string) => {
  const value = String(rawValue || "").trim();
  if (!value || value === "*") {
    return "*";
  }

  const list = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return list.length ? list : "*";
};

async function bootstrap() {
  normalizeDatabaseUrl();

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const allowedOrigins = parseAllowedOrigins(configService.get<string>("ALLOWED_ORIGIN", "*"));

  // Accept larger JSON/form payloads for base64 PDF attachments.
  app.use(json({ limit: "20mb" }));
  app.use(urlencoded({ limit: "20mb", extended: true }));
  app.use(helmet());

  app.enableCors({
    origin: allowedOrigins,
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
}

bootstrap();
