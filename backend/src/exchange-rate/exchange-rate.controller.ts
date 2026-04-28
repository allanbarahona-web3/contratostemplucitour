import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/roles.decorator";
import { ExchangeRateService } from "./exchange-rate.service";
import { SetExchangeRateDto } from "./dto/set-exchange-rate.dto";

@Controller("exchange-rate")
@UseGuards(JwtAuthGuard)
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  /**
   * Get current exchange rate (available to all authenticated users)
   */
  @Get("current")
  async getCurrentRate() {
    const rate = await this.exchangeRateService.getCurrentExchangeRate();
    return { rate };
  }

  /**
   * Get exchange rate for a specific date (available to all authenticated users)
   */
  @Get()
  async getRate(@Query("date") date?: string) {
    const rate = await this.exchangeRateService.getExchangeRate(date);
    return { rate };
  }

  /**
   * Get exchange rate history (available to all authenticated users)
   */
  @Get("history")
  async getHistory(@Query("days") days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const rates = await this.exchangeRateService.getExchangeRateHistory(daysNum);
    return { rates };
  }

  /**
   * Set exchange rate for a specific date (admin only)
   */
  @Post("set")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async setRate(@Body() dto: SetExchangeRateDto, @Request() req: any) {
    const user = req.user;
    const rate = await this.exchangeRateService.setExchangeRate(dto, user);
    return { rate };
  }

  /**
   * Get exchange rate history for a specific date range (available to all authenticated users)
   */
  @Get("history-range")
  async getHistoryRange(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    if (!startDate || !endDate) {
      return { error: "startDate and endDate are required", rates: [] };
    }
    const rates = await this.exchangeRateService.getExchangeRateHistoryRange(startDate, endDate);
    return { rates };
  }

  /**
   * Export exchange rate history as PDF (available to all authenticated users)
   */
  @Get("export-pdf")
  async exportPdf(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Res() res: Response,
  ) {
    if (!startDate || !endDate) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: "startDate and endDate are required" });
    }

    const pdfBuffer = await this.exchangeRateService.generateHistoryPdf(startDate, endDate);
    
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="historial-tipo-cambio-${startDate}-${endDate}.pdf"`,
      "Content-Length": pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  /**
   * Send exchange rate history via email (admin only)
   */
  @Post("email-history")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "FACTURACION_COBROS")
  async emailHistory(
    @Body() body: { startDate: string; endDate: string; email: string },
    @Request() req: any,
  ) {
    const { startDate, endDate, email } = body;

    if (!startDate || !endDate || !email) {
      return { success: false, error: "startDate, endDate, and email are required" };
    }

    const user = req.user;
    const userName = String(user?.fullName || "Usuario");

    await this.exchangeRateService.sendHistoryEmail(startDate, endDate, email, userName);

    return { success: true, message: "Historial enviado por correo exitosamente" };
  }
}
