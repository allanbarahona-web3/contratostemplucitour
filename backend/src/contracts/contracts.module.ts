import { Module } from "@nestjs/common";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";
import { PdfRenderService } from "./pdf-render.service";

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, PdfRenderService],
})
export class ContractsModule {}
