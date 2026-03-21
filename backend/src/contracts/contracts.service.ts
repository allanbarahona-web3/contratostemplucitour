import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";
import { ArchiveContractDto } from "./dto/archive-contract.dto";
import { SendContractEmailDto } from "./dto/send-contract-email.dto";
import { SearchContractsDto } from "./dto/search-contracts.dto";

@Injectable()
export class ContractsService {
  private s3Client: S3Client | null = null;

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

    const contractNumber = dto.contractNumber.trim();
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
        clientFullName: dto.clientFullName.trim(),
        clientIdNumber: dto.clientIdNumber.trim(),
        clientEmail: dto.clientEmail.trim().toLowerCase(),
        destination: dto.destination.trim(),
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
      documentCount: archived.documents.length,
      createdAt: archived.createdAt,
    };
  }

  async searchContracts(_user: { id: string; email: string; fullName: string }, query: SearchContractsDto) {
    const q = String(query.q || "").trim();
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);

    const where = q
      ? {
          OR: [
            { contractNumber: { contains: q, mode: "insensitive" as const } },
            { clientFullName: { contains: q, mode: "insensitive" as const } },
            { clientIdNumber: { contains: q, mode: "insensitive" as const } },
            { clientEmail: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const items = await (this.prisma as any).contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
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
        clientFullName: item.clientFullName,
        clientIdNumber: item.clientIdNumber,
        clientEmail: item.clientEmail,
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
      pdf: {
        fileName: contract.pdfFileName,
        mimeType: contract.pdfMimeType,
        size: contract.pdfSize,
        url: pdfUrl,
      },
      documents,
    };
  }
}
