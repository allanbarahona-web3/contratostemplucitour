import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Response } from "express";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ArchiveContractDto } from "./dto/archive-contract.dto";
import { CreateSigningLinkDto } from "./dto/create-signing-link.dto";
import { FinalizeContractSignaturePublicDto } from "./dto/finalize-contract-signature-public.dto";
import { FinalizeContractSignatureDto } from "./dto/finalize-contract-signature.dto";
import { PublicSigningSessionDto } from "./dto/public-signing-session.dto";
import { SearchContractsDto } from "./dto/search-contracts.dto";
import { ContractsService } from "./contracts.service";
import { SendContractEmailDto } from "./dto/send-contract-email.dto";
import { SendSigningEmailDto } from "./dto/send-signing-email.dto";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @UseGuards(JwtAuthGuard)
  @Post("next-number")
  reserveNextNumber(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
  ) {
    return this.contractsService.reserveNextNumber(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post("send-email")
  @UseInterceptors(FileInterceptor("pdfFile"))
  sendContractEmail(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
    @Body() dto: SendContractEmailDto,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
    },
  ) {
    if (!file) {
      throw new BadRequestException("Debes adjuntar el archivo PDF.");
    }

    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("El adjunto debe ser un PDF.");
    }

    if (!file.buffer?.length) {
      throw new BadRequestException("El PDF adjunto esta vacio.");
    }

    return this.contractsService.sendContractEmail(req.user, dto, file.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Post("archive")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "documents", maxCount: 20 },
    ]),
  )
  archiveContract(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
    @Body() dto: ArchiveContractDto,
    @UploadedFiles()
    files: {
      documents?: Array<{
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
      }>;
    },
  ) {
    return this.contractsService.archiveContract(
      req.user,
      dto,
      files?.documents || [],
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  searchContracts(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
    @Query() query: SearchContractsDto,
  ) {
    return this.contractsService.searchContracts(req.user, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(":contractId/files")
  getContractFiles(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
    @Param("contractId") contractId: string,
  ) {
    return this.contractsService.getContractFiles(req.user, contractId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("internal/:contractId/finalize-signature")
  @UseInterceptors(FileInterceptor("signedPdfFile"))
  finalizeContractSignature(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    @Param("contractId") contractId: string,
    @Body() dto: FinalizeContractSignatureDto,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException("Debes adjuntar el PDF firmado por el cliente.");
    }

    if (file.mimetype !== "application/pdf") {
      throw new BadRequestException("El documento firmado debe estar en formato PDF.");
    }

    const userAgentHeader = req.headers?.["user-agent"];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

    return this.contractsService.finalizeContractSignature(
      req.user,
      contractId,
      dto,
      file,
      req.ip || null,
      userAgent || null,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(":contractId/signing-link")
  createSigningLink(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
    @Param("contractId") contractId: string,
    @Body() dto: CreateSigningLinkDto,
  ) {
    return this.contractsService.createContractSigningLink(req.user, contractId, dto.ttlMinutes);
  }

  @UseGuards(JwtAuthGuard)
  @Post("send-signing-email")
  sendSigningEmail(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
    @Body() dto: SendSigningEmailDto,
  ) {
    return this.contractsService.sendContractSigningEmail(req.user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(":contractId/resend-signed-email")
  resendSignedEmail(
    @Req()
    req: {
      user: { id: string; email: string; fullName: string };
    },
    @Param("contractId") contractId: string,
  ) {
    return this.contractsService.resendSignedContractEmailToParties(req.user, contractId);
  }

  @Get("public/signing-session")
  getPublicSigningSession(@Query() query: PublicSigningSessionDto) {
    return this.contractsService.getPublicSigningSession(query.token);
  }

  @Get("public/signing-pdf")
  async getPublicSigningPdf(
    @Query() query: PublicSigningSessionDto,
    @Res() res: Response,
  ) {
    const file = await this.contractsService.getPublicSigningPdf(query.token);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${file.fileName}"`);
    res.setHeader("Content-Length", String(file.buffer.length));
    res.status(200).send(file.buffer);
  }

  @Post("public/mark-viewed")
  markContractViewed(@Body() body: { token?: string }) {
    const token = String(body?.token || "").trim();
    if (!token) {
      throw new BadRequestException("Se requiere el token.");
    }
    return this.contractsService.markContractViewed(token);
  }

  @Post("public/finalize-signature")
  finalizePublicContractSignature(
    @Req()
    req: {
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    @Body() dto: FinalizeContractSignaturePublicDto,
  ) {
    const userAgentHeader = req.headers?.["user-agent"];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

    return this.contractsService.finalizeContractSignatureByToken(
      dto.token,
      dto.signedByName,
      dto.signatureImageBase64,
      req.ip || null,
      userAgent || null,
    );
  }
}
