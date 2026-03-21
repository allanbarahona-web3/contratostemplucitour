import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import { PrismaService } from "../prisma/prisma.service";
import { SendContractEmailDto } from "./dto/send-contract-email.dto";

@Injectable()
export class ContractsService {
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
    const cleanedBase64 = String(dto.pdfBase64 || "").replace(/^data:application\/pdf;base64,/, "");
    const pdfBytes = Buffer.from(cleanedBase64, "base64");

    if (!pdfBytes.length) {
      throw new InternalServerErrorException("Adjunto PDF invalido o vacio.");
    }

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
            content: cleanedBase64,
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
}
