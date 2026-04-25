import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { ListBankAccountsDto } from './dto/list-bank-accounts.dto';

@Injectable()
export class CompanyBankAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateBankAccountDto,
    userId: string,
    userName: string,
  ) {
    // Verificar que no exista otra cuenta con el mismo número
    const existing = await this.prisma.companyBankAccount.findUnique({
      where: { accountNumber: dto.accountNumber },
    });

    if (existing) {
      throw new ConflictException(
        `Ya existe una cuenta bancaria con el número: ${dto.accountNumber}`,
      );
    }

    return this.prisma.companyBankAccount.create({
      data: {
        ...dto,
        isActive: dto.isActive ?? true,
        createdByUserId: userId,
        createdByName: userName,
      },
    });
  }

  async findAll(filters: ListBankAccountsDto) {
    const where: any = {};

    if (filters.bankName) {
      where.bankName = { contains: filters.bankName, mode: 'insensitive' };
    }

    if (filters.currency) {
      where.currency = filters.currency;
    }

    if (filters.isActive && filters.isActive !== 'all') {
      where.isActive = filters.isActive === 'true';
    }

    const accounts = await this.prisma.companyBankAccount.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { bankName: 'asc' },
        { currency: 'asc' },
      ],
    });

    return accounts;
  }

  async findOne(id: string) {
    const account = await this.prisma.companyBankAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(
        `Cuenta bancaria con ID ${id} no encontrada`,
      );
    }

    return account;
  }

  async findByAccountNumber(accountNumber: string) {
    const normalized = String(accountNumber || '').trim();
    if (!normalized) return null;

    // Buscar en accountNumber o sinpeNumber
    return this.prisma.companyBankAccount.findFirst({
      where: {
        OR: [
          { accountNumber: normalized },
          { sinpeNumber: normalized },
        ],
      },
    });
  }

  async update(id: string, dto: UpdateBankAccountDto) {
    // Verificar que existe
    await this.findOne(id);

    // Si está cambiando el número de cuenta, verificar que no exista
    if (dto.accountNumber) {
      const existing = await this.prisma.companyBankAccount.findFirst({
        where: {
          accountNumber: dto.accountNumber,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Ya existe otra cuenta con el número: ${dto.accountNumber}`,
        );
      }
    }

    return this.prisma.companyBankAccount.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const account = await this.findOne(id);

    // Verificar que no tenga pagos asociados
    if ((account as any)._count.payments > 0) {
      throw new BadRequestException(
        `No se puede eliminar esta cuenta porque tiene ${(account as any)._count.payments} pagos asociados. Considera desactivarla en su lugar.`,
      );
    }

    return this.prisma.companyBankAccount.delete({
      where: { id },
    });
  }

  async toggleActive(id: string) {
    const account = await this.findOne(id);

    return this.prisma.companyBankAccount.update({
      where: { id },
      data: { isActive: !account.isActive },
    });
  }
}
