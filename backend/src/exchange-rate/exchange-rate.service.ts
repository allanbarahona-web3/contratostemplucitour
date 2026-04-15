import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SetExchangeRateDto } from "./dto/set-exchange-rate.dto";

@Injectable()
export class ExchangeRateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the exchange rate for a specific date (or today if not provided)
   */
  async getExchangeRate(date?: string) {
    let targetDate: Date;
    if (date) {
      // Parse YYYY-MM-DD as local date to avoid timezone issues
      const [year, month, day] = date.split('-').map(Number);
      targetDate = new Date(year, month - 1, day);
    } else {
      targetDate = new Date();
    }
    targetDate.setHours(0, 0, 0, 0);

    const rate = await (this.prisma as any).exchangeRate.findUnique({
      where: { date: targetDate },
    });

    if (!rate) {
      return null;
    }

    return {
      id: rate.id,
      date: rate.date,
      buyRate: Number(rate.buyRate),
      sellRate: Number(rate.sellRate),
      source: rate.source,
      setByName: rate.setByName,
      notes: rate.notes,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  }

  /**
   * Get current (today's) exchange rate
   */
  async getCurrentExchangeRate() {
    return this.getExchangeRate();
  }

  /**
   * Get exchange rate history (last N days)
   */
  async getExchangeRateHistory(days = 30) {
    const rates = await (this.prisma as any).exchangeRate.findMany({
      orderBy: { date: "desc" },
      take: days,
    });

    return rates.map((rate: any) => ({
      id: rate.id,
      date: rate.date,
      buyRate: Number(rate.buyRate),
      sellRate: Number(rate.sellRate),
      source: rate.source,
      setByName: rate.setByName,
      notes: rate.notes,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    }));
  }

  /**
   * Set exchange rate for a specific date (admin only)
   */
  async setExchangeRate(
    dto: SetExchangeRateDto,
    user: { id: string; fullName: string },
  ) {
    // Parse YYYY-MM-DD as local date to avoid timezone issues
    const [year, month, day] = dto.date.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);
    targetDate.setHours(0, 0, 0, 0);

    const existing = await (this.prisma as any).exchangeRate.findUnique({
      where: { date: targetDate },
    });

    let rate;

    if (existing) {
      // Update existing rate
      rate = await (this.prisma as any).exchangeRate.update({
        where: { id: existing.id },
        data: {
          buyRate: dto.buyRate.toFixed(4),
          sellRate: dto.sellRate.toFixed(4),
          notes: dto.notes || null,
          setByUserId: user.id,
          setByName: user.fullName,
        },
      });
    } else {
      // Create new rate
      rate = await (this.prisma as any).exchangeRate.create({
        data: {
          date: targetDate,
          buyRate: dto.buyRate.toFixed(4),
          sellRate: dto.sellRate.toFixed(4),
          source: "MANUAL",
          setByUserId: user.id,
          setByName: user.fullName,
          notes: dto.notes || null,
        },
      });
    }

    return {
      id: rate.id,
      date: rate.date,
      buyRate: Number(rate.buyRate),
      sellRate: Number(rate.sellRate),
      source: rate.source,
      setByName: rate.setByName,
      notes: rate.notes,
      createdAt: rate.createdAt,
      updatedAt: rate.updatedAt,
    };
  }
}
