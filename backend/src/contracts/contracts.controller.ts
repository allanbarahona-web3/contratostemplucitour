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
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ArchiveContractDto } from "./dto/archive-contract.dto";
import { SearchContractsDto } from "./dto/search-contracts.dto";
import { ContractsService } from "./contracts.service";
import { SendContractEmailDto } from "./dto/send-contract-email.dto";

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
      { name: "pdfFile", maxCount: 1 },
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
      pdfFile?: Array<{
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
      }>;
      documents?: Array<{
        buffer: Buffer;
        mimetype: string;
        originalname: string;
        size: number;
      }>;
    },
  ) {
    const pdfFile = files?.pdfFile?.[0];
    if (!pdfFile) {
      throw new BadRequestException("Debes adjuntar el PDF del contrato.");
    }

    return this.contractsService.archiveContract(
      req.user,
      dto,
      pdfFile,
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
}
