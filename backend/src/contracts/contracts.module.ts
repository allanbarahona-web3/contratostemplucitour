import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";
import { PdfRenderService } from "./pdf-render.service";

@Module({
  imports: [BillingModule],
  controllers: [ContractsController],
  providers: [ContractsService, PdfRenderService],
})
export class ContractsModule {}
