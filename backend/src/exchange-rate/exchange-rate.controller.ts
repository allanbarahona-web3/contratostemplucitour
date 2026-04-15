import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
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
}
