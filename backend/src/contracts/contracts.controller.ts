import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ArchiveContractDto } from "./dto/archive-contract.dto";
import { CreateSigningLinkDto } from "./dto/create-signing-link.dto";
import { FinalizeContractSignaturePublicDto } from "./dto/finalize-contract-signature-public.dto";

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

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Get("public/signing-session")
  getPublicSigningSession(
    @Req() req: { ip?: string },
    @Query() query: PublicSigningSessionDto,
  ) {
    return this.contractsService.getPublicSigningSession(query.token, req.ip || null);
  }

  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @Post("public/mark-viewed")
  markContractViewed(
    @Req() req: { ip?: string },
    @Body() body: { token?: string },
  ) {
    const token = String(body?.token || "").trim();
    if (!token) {
      throw new BadRequestException("Se requiere el token.");
    }
    return this.contractsService.markContractViewed(token, req.ip || null);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
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
