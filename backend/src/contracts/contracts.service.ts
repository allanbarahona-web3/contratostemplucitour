import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";
import { ArchiveContractDto } from "./dto/archive-contract.dto";
import { FinalizeContractSignatureDto } from "./dto/finalize-contract-signature.dto";
import { SendContractEmailDto } from "./dto/send-contract-email.dto";
import { SendSigningEmailDto } from "./dto/send-signing-email.dto";
import { SearchContractsDto } from "./dto/search-contracts.dto";

const CONTRACT_STATUS_PENDING_SIGNATURE = "PENDING_SIGNATURE";
const CONTRACT_STATUS_SIGNED = "SIGNED";
const SIGNING_TOKEN_VERSION = 1;

@Injectable()
export class ContractsService {
  private s3Client: S3Client | null = null;
  private readonly maxDocumentCount = 20;
  private readonly maxDocumentSizeBytes = 5 * 1024 * 1024;
  private readonly maxDocumentTotalBytes = 25 * 1024 * 1024;
  private readonly allowedDocumentMimeTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private pad(value: number, size = 2) {
    return String(value).padStart(size, "0");
  }

  private randomHex(bytes = 2) {
    return randomBytes(bytes).toString("hex").toUpperCase();
  }

  private buildContractNumber() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = this.pad(now.getMonth() + 1);
    const dd = this.pad(now.getDate());
    const hh = this.pad(now.getHours());
    const min = this.pad(now.getMinutes());
    const ss = this.pad(now.getSeconds());
    const ms = this.pad(now.getMilliseconds(), 3);
    const unique = this.randomHex(2);

    return `LUC-${yyyy}${mm}${dd}-${hh}${min}${ss}${ms}-${unique}`;
  }

  private getSpacesConfig() {
    const region = this.configService.get<string>("DO_SPACES_REGION", "").trim();
    const endpoint = this.configService.get<string>("DO_SPACES_ENDPOINT", "").trim();
    const bucket = this.configService.get<string>("DO_SPACES_BUCKET", "").trim();
    const key = this.configService.get<string>("DO_SPACES_KEY", "").trim();
    const secret = this.configService.get<string>("DO_SPACES_SECRET", "").trim();

    if (!region || !endpoint || !bucket || !key || !secret) {
      throw new InternalServerErrorException(
        "Faltan variables DO_SPACES_REGION, DO_SPACES_ENDPOINT, DO_SPACES_BUCKET, DO_SPACES_KEY o DO_SPACES_SECRET.",
      );
    }

    return {
      region,
      endpoint,
      bucket,
      key,
      secret,
    };
  }

  private getSpacesClient() {
    if (this.s3Client) {
      return this.s3Client;
    }

    const cfg = this.getSpacesConfig();
    this.s3Client = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: false,
      credentials: {
        accessKeyId: cfg.key,
        secretAccessKey: cfg.secret,
      },
    });

    return this.s3Client;
  }

  private sanitizeSegment(value: string) {
    const normalized = String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || "file";
  }

  private toDateOrNull(value?: string) {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toBase64Url(value: string) {
    return Buffer.from(value, "utf8").toString("base64url");
  }

  private fromBase64Url(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  private getSigningSecret() {
    const explicitSecret = this.configService.get<string>("SIGNING_LINK_SECRET", "").trim();
    if (explicitSecret) {
      return explicitSecret;
    }

    const jwtSecret = this.configService.get<string>("JWT_SECRET", "").trim();
    if (jwtSecret) {
      return jwtSecret;
    }

    throw new InternalServerErrorException("Falta configurar SIGNING_LINK_SECRET o JWT_SECRET.");
  }

  private signPayload(payloadB64: string) {
    return createHmac("sha256", this.getSigningSecret()).update(payloadB64).digest("base64url");
  }

  private buildSigningToken(contractId: string, expiresAt: Date) {
    const payload = {
      v: SIGNING_TOKEN_VERSION,
      contractId,
      exp: expiresAt.toISOString(),
    };

    const payloadB64 = this.toBase64Url(JSON.stringify(payload));
    const signature = this.signPayload(payloadB64);
    return `${payloadB64}.${signature}`;
  }

  private parseSigningToken(token: string) {
    const normalized = String(token || "").trim();
    const [payloadB64, signature] = normalized.split(".");
    if (!payloadB64 || !signature) {
      throw new BadRequestException("Token de firma invalido.");
    }

    const expected = this.signPayload(payloadB64);
    const providedBuf = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");

    if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
      throw new BadRequestException("Token de firma invalido.");
    }

    let payload: { v: number; contractId: string; exp: string };
    try {
      payload = JSON.parse(this.fromBase64Url(payloadB64));
    } catch {
      throw new BadRequestException("Token de firma invalido.");
    }

    if (payload.v !== SIGNING_TOKEN_VERSION || !payload.contractId || !payload.exp) {
      throw new BadRequestException("Token de firma invalido.");
    }

    const expDate = new Date(payload.exp);
    if (Number.isNaN(expDate.getTime()) || expDate.getTime() <= Date.now()) {
      throw new BadRequestException("El enlace de firma expiro.");
    }

    return {
      contractId: payload.contractId,
      expiresAt: expDate,
    };
  }

  private getPublicAppBaseUrl() {
    const explicit = this.configService.get<string>("PUBLIC_APP_BASE_URL", "").trim();
    if (explicit) {
      return explicit.replace(/\/+$/, "");
    }

    const allowedOrigin = this.configService.get<string>("ALLOWED_ORIGIN", "").trim();
    const origins = allowedOrigin
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.startsWith("http://") || item.startsWith("https://"));

    const preferredOrigin =
      origins.find((item) => item.startsWith("https://") && !/localhost|127\.0\.0\.1/i.test(item)) ||
      origins.find((item) => !/localhost|127\.0\.0\.1/i.test(item)) ||
      origins[0];

    if (preferredOrigin) {
      return preferredOrigin.replace(/\/+$/, "");
    }

    throw new InternalServerErrorException("No se pudo resolver PUBLIC_APP_BASE_URL para generar links de firma.");
  }

  private async uploadToSpaces(params: {
    objectKey: string;
    contentType: string;
    body: Buffer;
  }) {
    const cfg = this.getSpacesConfig();
    const client = this.getSpacesClient();

    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: params.objectKey,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );
  }

  private async buildSignedObjectUrl(objectKey: string, expiresInSeconds = 900) {
    const cfg = this.getSpacesConfig();
    const client = this.getSpacesClient();

    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  private async downloadObjectBuffer(objectKey: string) {
    const cfg = this.getSpacesConfig();
    const client = this.getSpacesClient();
    const response = await client.send(
      new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
      }),
    );

    const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) {
      throw new InternalServerErrorException("No se pudo leer el archivo de contrato.");
    }

    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async reserveNextNumber(user: { id: string; email: string; fullName: string }) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const contractNumber = this.buildContractNumber();

      try {
        await (this.prisma as any).contractNumber.create({
          data: {
            number: contractNumber,
            createdByUserId: user.id,
            createdByEmail: user.email,
            createdByName: user.fullName,
          },
        });

        return {
          contractNumber,
          createdBy: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
          },
        };
      } catch (error) {
        const isUniqueConflict =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          String((error as { code?: string }).code) === "P2002";

        if (isUniqueConflict) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("No se pudo generar un numero de contrato unico.");
  }

  async sendContractEmail(
    user: { id: string; email: string; fullName: string },
    dto: SendContractEmailDto,
    pdfBuffer: Buffer,
  ) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY", "").trim();
    const fromEmail = this.configService
      .get<string>("CONTRACTS_FROM_EMAIL", "")
      .trim();

    if (!apiKey || !fromEmail) {
      throw new InternalServerErrorException(
        "Falta configurar RESEND_API_KEY o CONTRACTS_FROM_EMAIL.",
      );
    }

    const resend = new Resend(apiKey);
    if (!pdfBuffer.length) {
      throw new InternalServerErrorException("Adjunto PDF invalido o vacio.");
    }

    const pdfBase64 = pdfBuffer.toString("base64");

    const subject = `Contrato para firma - ${dto.contractNumber}`;
    const html = `
      <p>Hola ${dto.clientName},</p>
      <p>Te compartimos tu contrato <strong>${dto.contractNumber}</strong> en formato PDF adjunto para firma y revision.</p>
      <p>Si tienes alguna duda, puedes responder este correo.</p>
      <p>Atentamente,<br/>Lucitour</p>
    `;

    try {
      const result = await resend.emails.send({
        from: fromEmail,
        to: [dto.toEmail],
        subject,
        html,
        attachments: [
          {
            filename: dto.fileName,
            content: pdfBase64,
          },
        ],
      });

      return {
        ok: true,
        emailId: result.data?.id || null,
        sentTo: dto.toEmail,
        contractNumber: dto.contractNumber,
        sentBy: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      };
    } catch {
      throw new InternalServerErrorException("No se pudo enviar el correo con el contrato adjunto.");
    }
  }

  async sendContractSigningEmail(
    user: { id: string; email: string; fullName: string },
    dto: SendSigningEmailDto,
  ) {
    const apiKey = this.configService.get<string>("RESEND_API_KEY", "").trim();
    const fromEmail =
      this.configService.get<string>("CONTRACTS_FROM_EMAIL", "").trim() ||
      this.configService.get<string>("AUTH_FROM_EMAIL", "").trim();

    if (!apiKey || !fromEmail) {
      throw new InternalServerErrorException(
        "Falta configurar RESEND_API_KEY o CONTRACTS_FROM_EMAIL.",
      );
    }

    const resend = new Resend(apiKey);
    const html = `
      <p>Hola ${dto.clientName},</p>
      <p>Tu contrato <strong>${dto.contractNumber}</strong> esta listo para firma.</p>
      <p>Abre este enlace, revisa el documento y firma con tu dedo en pantalla:</p>
      <p><a href="${dto.signingUrl}">Firmar contrato ahora</a></p>
      <p>Atentamente,<br/>Lucitours</p>
    `;

    try {
      const result = await resend.emails.send({
        from: fromEmail,
        to: [dto.toEmail],
        subject: `Firma pendiente de contrato - ${dto.contractNumber}`,
        html,
      });

      return {
        ok: true,
        emailId: result.data?.id || null,
        sentTo: dto.toEmail,
        contractNumber: dto.contractNumber,
        sentBy: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
      };
    } catch {
      throw new InternalServerErrorException("No se pudo enviar el correo de firma al cliente.");
    }
  }

  async createContractSigningLink(
    _user: { id: string; email: string; fullName: string },
    contractId: string,
    ttlMinutes = 60 * 24,
  ) {
    const contract = await (this.prisma as any).contract.findUnique({
      where: { id: contractId },
      include: {
        client: true,
      },
    });

    if (!contract) {
      throw new NotFoundException("Contrato no encontrado.");
    }

    if (contract.status === CONTRACT_STATUS_SIGNED) {
      throw new BadRequestException("Este contrato ya esta firmado.");
    }

    const safeTtlMinutes = Math.min(Math.max(Number(ttlMinutes) || 0, 15), 60 * 24 * 7);
    const expiresAt = new Date(Date.now() + safeTtlMinutes * 60 * 1000);
    const token = this.buildSigningToken(contract.id, expiresAt);
    const baseUrl = this.getPublicAppBaseUrl();
    const signingUrl = `${baseUrl}/sign-contract.html?token=${encodeURIComponent(token)}`;

    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      clientName: contract.client?.fullName || null,
      clientEmail: contract.client?.email || null,
      signingUrl,
      expiresAt,
    };
  }

  async archiveContract(
    user: { id: string; email: string; fullName: string },
    dto: ArchiveContractDto,
    pdfFile: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    documents: Array<{
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    }> = [],
  ) {
    let payload: unknown;
    try {
      payload = JSON.parse(dto.payloadJson);
    } catch {
      throw new InternalServerErrorException("payloadJson no tiene un JSON valido.");
    }

    if (!pdfFile?.buffer?.length || pdfFile.mimetype !== "application/pdf") {
      throw new InternalServerErrorException("Debes adjuntar un PDF valido para archivar el contrato.");
    }

    if (documents.length > this.maxDocumentCount) {
      throw new BadRequestException(`Solo se permiten ${this.maxDocumentCount} adjuntos por contrato.`);
    }

    let documentTotalBytes = 0;
    for (const doc of documents) {
      if (!doc?.buffer?.length) {
        continue;
      }

      const mime = String(doc.mimetype || "").toLowerCase();
      if (!this.allowedDocumentMimeTypes.has(mime)) {
        throw new BadRequestException("Adjunto invalido. Solo se permiten PDF, JPG, PNG o WEBP.");
      }

      const size = doc.size || doc.buffer.length;
      if (size > this.maxDocumentSizeBytes) {
        throw new BadRequestException("Un adjunto supera el limite de 5 MB por archivo.");
      }

      documentTotalBytes += size;
      if (documentTotalBytes > this.maxDocumentTotalBytes) {
        throw new BadRequestException("El total de adjuntos supera el limite de 25 MB.");
      }
    }

    const contractNumber = dto.contractNumber.trim();
    const payloadRecord =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const clientPhone = String(payloadRecord.clientPhone || "").trim() || null;
    const emergencyContactName =
      String(payloadRecord.emergencyContactName || "").trim() || null;
    const emergencyContactPhone =
      String(payloadRecord.emergencyContactPhone || "").trim() || null;

    const client = await (this.prisma as any).client.upsert({
      where: { idNumber: dto.clientIdNumber.trim() },
      update: {
        fullName: dto.clientFullName.trim(),
        email: dto.clientEmail.trim().toLowerCase(),
        phone: clientPhone,
        emergencyContactName,
        emergencyContactPhone,
      },
      create: {
        fullName: dto.clientFullName.trim(),
        idNumber: dto.clientIdNumber.trim(),
        email: dto.clientEmail.trim().toLowerCase(),
        phone: clientPhone,
        emergencyContactName,
        emergencyContactPhone,
      },
    });

    const now = new Date();
    const y = now.getFullYear();
    const m = this.pad(now.getMonth() + 1);
    const d = this.pad(now.getDate());
    const baseFolder = `contracts/${y}/${m}/${d}/${this.sanitizeSegment(contractNumber)}`;
    const pdfKey = `${baseFolder}/contract.pdf`;

    await this.uploadToSpaces({
      objectKey: pdfKey,
      contentType: "application/pdf",
      body: pdfFile.buffer,
    });

    const uploadedDocuments: Array<{
      kind?: string;
      originalFileName: string;
      objectKey: string;
      mimeType: string;
      size: number;
    }> = [];

    for (let index = 0; index < documents.length; index += 1) {
      const doc = documents[index];
      if (!doc?.buffer?.length) {
        continue;
      }

      const safeName = this.sanitizeSegment(doc.originalname || `document-${index + 1}`);
      const objectKey = `${baseFolder}/docs/${index + 1}-${safeName}`;
      await this.uploadToSpaces({
        objectKey,
        contentType: doc.mimetype || "application/octet-stream",
        body: doc.buffer,
      });

      uploadedDocuments.push({
        originalFileName: doc.originalname || `document-${index + 1}`,
        objectKey,
        mimeType: doc.mimetype || "application/octet-stream",
        size: doc.size || doc.buffer.length,
      });
    }

    const archived = await (this.prisma as any).contract.create({
      data: {
        contractNumber,
        clientId: client.id,
        destination: dto.destination.trim(),
        status: CONTRACT_STATUS_PENDING_SIGNATURE,
        generatedByUserId: user.id,
        generatedByEmail: user.email,
        generatedByName: user.fullName,
        issuedAt: this.toDateOrNull(dto.issuedAt),
        startDate: this.toDateOrNull(dto.startDate),
        endDate: this.toDateOrNull(dto.endDate),
        payload: payload as any,
        pdfObjectKey: pdfKey,
        pdfFileName: pdfFile.originalname || `${contractNumber}.pdf`,
        pdfMimeType: pdfFile.mimetype,
        pdfSize: pdfFile.size || pdfFile.buffer.length,
        documents: {
          create: uploadedDocuments.map((doc) => ({
            kind: null,
            originalFileName: doc.originalFileName,
            objectKey: doc.objectKey,
            mimeType: doc.mimeType,
            size: doc.size,
          })),
        },
      },
      include: {
        documents: true,
      },
    });

    return {
      id: archived.id,
      contractNumber: archived.contractNumber,
      status: archived.status,
      documentCount: archived.documents.length,
      createdAt: archived.createdAt,
    };
  }

  async finalizeContractSignature(
    _user: { id: string; email: string; fullName: string },
    contractId: string,
    dto: FinalizeContractSignatureDto,
    signedPdfFile: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    signedClientIp: string | null,
    signedUserAgent: string | null,
  ) {
    if (!signedPdfFile?.buffer?.length || signedPdfFile.mimetype !== "application/pdf") {
      throw new BadRequestException("Debes adjuntar un PDF firmado valido.");
    }

    const contract = await (this.prisma as any).contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException("Contrato no encontrado.");
    }

    if (contract.status === CONTRACT_STATUS_SIGNED && contract.signedPdfObjectKey) {
      throw new BadRequestException("Este contrato ya fue marcado como firmado.");
    }

    const keyRoot = String(contract.pdfObjectKey || "").replace(/\/contract\.pdf$/i, "");
    const fallbackKeyRoot = `contracts/signed/${this.sanitizeSegment(contract.contractNumber)}`;
    const baseFolder = keyRoot || fallbackKeyRoot;
    const signedObjectKey = `${baseFolder}/signed/contract-signed.pdf`;

    await this.uploadToSpaces({
      objectKey: signedObjectKey,
      contentType: "application/pdf",
      body: signedPdfFile.buffer,
    });

    const updated = await (this.prisma as any).contract.update({
      where: { id: contract.id },
      data: {
        status: CONTRACT_STATUS_SIGNED,
        signedPdfObjectKey: signedObjectKey,
        signedPdfFileName: signedPdfFile.originalname || `${contract.contractNumber}-signed.pdf`,
        signedPdfMimeType: signedPdfFile.mimetype,
        signedPdfSize: signedPdfFile.size || signedPdfFile.buffer.length,
        signedByName: String(dto.signedByName || "").trim(),
        signedAt: new Date(),
        signedClientIp,
        signedUserAgent,
      },
    });

    return {
      id: updated.id,
      contractNumber: updated.contractNumber,
      status: updated.status,
      signedAt: updated.signedAt,
    };
  }

  async finalizeContractSignatureByToken(
    token: string,
    signedByName: string,
    signedPdfFile: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    signedClientIp: string | null,
    signedUserAgent: string | null,
  ) {
    const parsed = this.parseSigningToken(token);
    return this.finalizeContractSignature(
      { id: "public", email: "public-signing", fullName: "Public Signing" },
      parsed.contractId,
      { signedByName },
      signedPdfFile,
      signedClientIp,
      signedUserAgent,
    );
  }

  async getPublicSigningSession(token: string) {
    const parsed = this.parseSigningToken(token);
    const contract = await (this.prisma as any).contract.findUnique({
      where: { id: parsed.contractId },
      include: {
        client: true,
      },
    });

    if (!contract) {
      throw new NotFoundException("Contrato no encontrado.");
    }

    const basePdfUrl = await this.buildSignedObjectUrl(contract.pdfObjectKey, 1200);
    const signedPdfUrl = contract.signedPdfObjectKey
      ? await this.buildSignedObjectUrl(contract.signedPdfObjectKey, 1200)
      : null;

    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      destination: contract.destination,
      clientName: contract.client?.fullName || "",
      status: contract.status || CONTRACT_STATUS_PENDING_SIGNATURE,
      pdfUrl: basePdfUrl,
      signedPdfUrl,
      expiresAt: parsed.expiresAt,
    };
  }

  async getPublicSigningPdf(token: string) {
    const parsed = this.parseSigningToken(token);
    const contract = await (this.prisma as any).contract.findUnique({
      where: { id: parsed.contractId },
      select: {
        contractNumber: true,
        pdfObjectKey: true,
        pdfFileName: true,
        signedPdfObjectKey: true,
        signedPdfFileName: true,
      },
    });

    if (!contract) {
      throw new NotFoundException("Contrato no encontrado.");
    }

    const objectKey = contract.signedPdfObjectKey || contract.pdfObjectKey;
    const fileName =
      contract.signedPdfFileName ||
      contract.pdfFileName ||
      `${String(contract.contractNumber || "contrato").trim()}-signing.pdf`;

    const buffer = await this.downloadObjectBuffer(objectKey);
    return {
      fileName,
      buffer,
    };
  }

  async searchContracts(_user: { id: string; email: string; fullName: string }, query: SearchContractsDto) {
    const q = String(query.q || "").trim();
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);

    const where = q
      ? {
          OR: [
            { contractNumber: { contains: q, mode: "insensitive" as const } },
            { client: { is: { fullName: { contains: q, mode: "insensitive" as const } } } },
            { client: { is: { idNumber: { contains: q, mode: "insensitive" as const } } } },
            { client: { is: { email: { contains: q, mode: "insensitive" as const } } } },
          ],
        }
      : {};

    const items = await (this.prisma as any).contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        client: true,
        documents: {
          select: {
            id: true,
          },
        },
      },
    });

    return {
      items: items.map((item: any) => ({
        id: item.id,
        contractNumber: item.contractNumber,
        status: item.status || CONTRACT_STATUS_PENDING_SIGNATURE,
        clientFullName: item.client?.fullName || "-",
        clientIdNumber: item.client?.idNumber || "-",
        clientEmail: item.client?.email || "-",
        destination: item.destination,
        generatedByName: item.generatedByName,
        createdAt: item.createdAt,
        documentCount: item.documents.length,
      })),
    };
  }

  async getContractFiles(
    _user: { id: string; email: string; fullName: string },
    contractId: string,
  ) {
    const contract = await (this.prisma as any).contract.findUnique({
      where: { id: contractId },
      include: { documents: true },
    });

    if (!contract) {
      throw new NotFoundException("Contrato no encontrado.");
    }

    const pdfUrl = await this.buildSignedObjectUrl(contract.pdfObjectKey);
    const signedPdfUrl = contract.signedPdfObjectKey
      ? await this.buildSignedObjectUrl(contract.signedPdfObjectKey)
      : null;
    const documents = await Promise.all(
      contract.documents.map(async (doc: any) => ({
        id: doc.id,
        originalFileName: doc.originalFileName,
        mimeType: doc.mimeType,
        size: doc.size,
        url: await this.buildSignedObjectUrl(doc.objectKey),
      })),
    );

    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      status: contract.status || CONTRACT_STATUS_PENDING_SIGNATURE,
      pdf: {
        fileName: contract.pdfFileName,
        mimeType: contract.pdfMimeType,
        size: contract.pdfSize,
        url: pdfUrl,
      },
      signedPdf: signedPdfUrl
        ? {
            fileName: contract.signedPdfFileName || `${contract.contractNumber}-signed.pdf`,
            mimeType: contract.signedPdfMimeType || "application/pdf",
            size: contract.signedPdfSize || 0,
            url: signedPdfUrl,
            signedByName: contract.signedByName || null,
            signedAt: contract.signedAt || null,
          }
        : null,
      documents,
    };
  }
}
