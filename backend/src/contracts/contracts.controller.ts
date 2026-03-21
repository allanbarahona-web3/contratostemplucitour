import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
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
}
