import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountTxnType, Prisma, SaleSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashierService {
  constructor(private readonly prisma: PrismaService) {}

  private dayKeyLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private monthKeyLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private startOfDay(d: Date): Date {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  private endExclusiveDay(d: Date): Date {
    const x = this.startOfDay(d);
    x.setDate(x.getDate() + 1);
    return x;
  }

  async getTodaySummary() {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [sales, debtPayAgg, walletDebitAgg] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          createdAt: { gte: start, lt: end },
        },
        select: {
          buyerType: true,
          total: true,
          addedDebt: true,
        },
      }),
      this.prisma.accountTxn.aggregate({
        where: {
          type: AccountTxnType.DEBT_PAY,
          createdAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
      this.prisma.accountTxn.aggregate({
        where: {
          type: AccountTxnType.WALLET_DEBIT,
          createdAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalSalesToday = sales.reduce((sum, s) => sum + s.total, 0);
    const totalTransactions = sales.length;
    const employeeTransactions = sales.filter(
      (s) => s.buyerType === 'EMPLOYEE',
    ).length;
    const generalTransactions = sales.filter(
      (s) => s.buyerType === 'GENERAL',
    ).length;
    const totalNewDebtToday = sales.reduce((sum, s) => sum + s.addedDebt, 0);

    return {
      date: start.toISOString(),
      totalSalesToday,
      totalTransactions,
      employeeTransactions,
      generalTransactions,
      totalNewDebtToday,
      totalDebtPaymentToday: debtPayAgg._sum.amount ?? 0,
      totalMandatoryWalletDeductedToday: walletDebitAgg._sum.amount ?? 0,
    };
  }

  async getDashboardSummary() {
    const now = new Date();
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date(startToday);
    endToday.setDate(endToday.getDate() + 1);

    const start7Days = new Date(startToday);
    start7Days.setDate(startToday.getDate() - 6);

    const start30Days = new Date(startToday);
    start30Days.setDate(startToday.getDate() - 29);

    const start12Months = new Date(startToday);
    start12Months.setDate(1);
    start12Months.setMonth(start12Months.getMonth() - 11);

    const [
      sales7Days,
      sales12Months,
      salesToday,
      productsAll,
      soldProductRows30Days,
      debtAgg,
      walletAgg,
      freqAgg,
    ] = await Promise.all([
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start7Days, lt: endToday } },
        select: { total: true, createdAt: true },
      }),
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start12Months, lt: endToday } },
        select: { total: true, createdAt: true },
      }),
      this.prisma.sale.findMany({
        where: { createdAt: { gte: startToday, lt: endToday } },
        select: { total: true, createdAt: true },
      }),
      this.prisma.product.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          isActive: true,
          stock: true,
        },
      }),
      this.prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: start30Days, lt: endToday } } },
        distinct: ['productId'],
        select: { productId: true },
      }),
      this.prisma.accountTxn.groupBy({
        by: ['employeeId', 'type'],
        where: {
          type: { in: [AccountTxnType.DEBT_ADD, AccountTxnType.DEBT_PAY] },
        },
        _sum: { amount: true },
      }),
      this.prisma.accountTxn.groupBy({
        by: ['employeeId', 'type'],
        where: {
          type: {
            in: [AccountTxnType.WALLET_CREDIT, AccountTxnType.WALLET_DEBIT],
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.sale.groupBy({
        by: ['employeeId'],
        where: {
          buyerType: 'EMPLOYEE',
          employeeId: { not: null },
        },
        _count: { id: true },
      }),
    ]);

    const chart7Days = (() => {
      const points: { key: string; label: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startToday);
        d.setDate(startToday.getDate() - i);
        points.push({
          key: this.dayKeyLocal(d),
          label: d.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
          }),
          total: 0,
        });
      }
      const m = new Map(points.map((p) => [p.key, p]));
      for (const s of sales7Days) {
        const key = this.dayKeyLocal(new Date(s.createdAt));
        const p = m.get(key);
        if (p) p.total += s.total;
      }
      return points;
    })();

    const chartMonthly = (() => {
      const points: { key: string; label: string; total: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(startToday);
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        points.push({
          key: this.monthKeyLocal(d),
          label: d.toLocaleDateString('id-ID', {
            month: 'short',
            year: '2-digit',
          }),
          total: 0,
        });
      }
      const m = new Map(points.map((p) => [p.key, p]));
      for (const s of sales12Months) {
        const key = this.monthKeyLocal(new Date(s.createdAt));
        const p = m.get(key);
        if (p) p.total += s.total;
      }
      return points;
    })();

    const chartHourly = (() => {
      const points = Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        total: 0,
        count: 0,
      }));
      for (const s of salesToday) {
        const h = new Date(s.createdAt).getHours();
        const p = points[h];
        if (p) {
          p.total += s.total;
          p.count += 1;
        }
      }
      return points;
    })();

    const soldIds30Days = new Set(
      soldProductRows30Days.map((x) => x.productId),
    );
    const lowStockProducts = productsAll.filter(
      (p) => p.isActive && p.stock < 5,
    );
    const inactiveProducts = productsAll.filter((p) => !p.isActive);
    const unsold30DaysProducts = productsAll.filter(
      (p) => !soldIds30Days.has(p.id),
    );

    const employeeIds = new Set<string>();
    for (const row of debtAgg) employeeIds.add(row.employeeId);
    for (const row of walletAgg) employeeIds.add(row.employeeId);
    for (const row of freqAgg) {
      if (row.employeeId) employeeIds.add(row.employeeId);
    }

    const employees = await this.prisma.employee.findMany({
      where: { id: { in: [...employeeIds] } },
      select: { id: true, name: true, employeeCode: true, isActive: true },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const debtByEmployee = new Map<string, number>();
    for (const row of debtAgg) {
      const prev = debtByEmployee.get(row.employeeId) ?? 0;
      const amt = row._sum.amount ?? 0;
      if (row.type === AccountTxnType.DEBT_ADD) {
        debtByEmployee.set(row.employeeId, prev + amt);
      } else {
        debtByEmployee.set(row.employeeId, prev - amt);
      }
    }

    const walletByEmployee = new Map<string, number>();
    for (const row of walletAgg) {
      const prev = walletByEmployee.get(row.employeeId) ?? 0;
      const amt = row._sum.amount ?? 0;
      if (row.type === AccountTxnType.WALLET_CREDIT) {
        walletByEmployee.set(row.employeeId, prev + amt);
      } else {
        walletByEmployee.set(row.employeeId, prev - amt);
      }
    }

    const topDebtEmployees = [...debtByEmployee.entries()]
      .map(([employeeId, debtBalance]) => ({ employeeId, debtBalance }))
      .filter((x) => x.debtBalance > 0)
      .filter((x) => {
        const emp = employeeMap.get(x.employeeId);
        return emp && emp.employeeCode !== 'GENERAL';
      })
      .sort((a, b) => b.debtBalance - a.debtBalance)
      .slice(0, 5)
      .map((x) => {
        const emp = employeeMap.get(x.employeeId)!;
        return {
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          debtBalance: x.debtBalance,
        };
      });

    const topWalletEmployees = [...walletByEmployee.entries()]
      .map(([employeeId, walletBalance]) => ({ employeeId, walletBalance }))
      .filter((x) => x.walletBalance > 0)
      .filter((x) => {
        const emp = employeeMap.get(x.employeeId);
        return emp && emp.employeeCode !== 'GENERAL';
      })
      .sort((a, b) => b.walletBalance - a.walletBalance)
      .slice(0, 5)
      .map((x) => {
        const emp = employeeMap.get(x.employeeId)!;
        return {
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          walletBalance: x.walletBalance,
        };
      });

    const topFrequentEmployees = freqAgg
      .filter((x) => x.employeeId)
      .map((x) => ({
        employeeId: x.employeeId as string,
        txCount: x._count.id,
      }))
      .filter((x) => {
        const emp = employeeMap.get(x.employeeId);
        return emp && emp.employeeCode !== 'GENERAL';
      })
      .sort((a, b) => b.txCount - a.txCount)
      .slice(0, 5)
      .map((x) => {
        const emp = employeeMap.get(x.employeeId)!;
        return {
          employeeId: emp.id,
          name: emp.name,
          employeeCode: emp.employeeCode,
          txCount: x.txCount,
        };
      });

    return {
      salesCharts: {
        last7Days: chart7Days,
        monthly: chartMonthly,
        hourlyToday: chartHourly,
      },
      productAlerts: {
        lowStockThreshold: 5,
        lowStockCount: lowStockProducts.length,
        lowStockProducts: lowStockProducts.slice(0, 20),
        inactiveCount: inactiveProducts.length,
        inactiveProducts: inactiveProducts.slice(0, 20),
        unsold30DaysCount: unsold30DaysProducts.length,
        unsold30DaysProducts: unsold30DaysProducts.slice(0, 20),
      },
      employeeRankings: {
        topDebtEmployees,
        topWalletEmployees,
        topFrequentEmployees,
      },
    };
  }

  async getFinancialReport(from: Date, to: Date) {
    const start = this.startOfDay(from);
    const endExclusive = this.endExclusiveDay(to);
    if (endExclusive <= start) {
      throw new BadRequestException('Range tanggal tidak valid');
    }

    const [sales, txnAgg] = await Promise.all([
      this.prisma.sale.findMany({
        where: { createdAt: { gte: start, lt: endExclusive } },
        select: {
          id: true,
          buyerType: true,
          total: true,
          cashPaid: true,
          paidByMandatory: true,
          addedDebt: true,
        },
      }),
      this.prisma.accountTxn.groupBy({
        by: ['type'],
        where: { createdAt: { gte: start, lt: endExclusive } },
        _sum: { amount: true },
      }),
    ]);

    const sumTxn = (type: AccountTxnType) =>
      txnAgg.find((x) => x.type === type)?._sum.amount ?? 0;

    const totalSales = sales.reduce((s, x) => s + x.total, 0);
    const totalCashFromSales = sales.reduce((s, x) => s + x.cashPaid, 0);
    const totalWalletUsed = sales.reduce((s, x) => s + x.paidByMandatory, 0);
    const totalNewDebt = sales.reduce((s, x) => s + x.addedDebt, 0);
    const employeeSales = sales
      .filter((x) => x.buyerType === 'EMPLOYEE')
      .reduce((s, x) => s + x.total, 0);
    const generalSales = sales
      .filter((x) => x.buyerType === 'GENERAL')
      .reduce((s, x) => s + x.total, 0);

    const debtPayment = sumTxn(AccountTxnType.DEBT_PAY);
    const walletCredit = sumTxn(AccountTxnType.WALLET_CREDIT);
    const walletDebit = sumTxn(AccountTxnType.WALLET_DEBIT);
    const debtAdd = sumTxn(AccountTxnType.DEBT_ADD);

    return {
      period: {
        from: start.toISOString(),
        to: new Date(endExclusive.getTime() - 1).toISOString(),
      },
      sales: {
        transactionCount: sales.length,
        totalSales,
        employeeSales,
        generalSales,
      },
      movements: {
        cashFromSales: totalCashFromSales,
        walletUsed: totalWalletUsed,
        debtAddedFromSales: totalNewDebt,
        debtPayment,
        walletTopupCredit: walletCredit,
      },
      ledgerSummary: {
        debtAdd,
        debtPay: debtPayment,
        walletCredit,
        walletDebit,
      },
      cashflowEstimate: {
        totalCashIn: totalCashFromSales + debtPayment + walletCredit,
      },
    };
  }

  async getBalanceSheet(asOf?: Date) {
    const endExclusive = asOf
      ? this.endExclusiveDay(asOf)
      : this.endExclusiveDay(new Date());

    const [products, txnAgg] = await Promise.all([
      this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          stock: true,
          price: true,
          discountPct: true,
          taxPct: true,
        },
      }),
      this.prisma.accountTxn.groupBy({
        by: ['type'],
        where: { createdAt: { lt: endExclusive } },
        _sum: { amount: true },
      }),
    ]);

    const sumTxn = (type: AccountTxnType) =>
      txnAgg.find((x) => x.type === type)?._sum.amount ?? 0;

    const inventoryValue = products.reduce((sum, p) => {
      const discountPerUnit = Math.trunc((p.price * p.discountPct) / 100);
      const taxablePerUnit = p.price - discountPerUnit;
      const taxPerUnit = Math.trunc((taxablePerUnit * p.taxPct) / 100);
      const finalUnitPrice = taxablePerUnit + taxPerUnit;
      return sum + Math.max(0, p.stock) * finalUnitPrice;
    }, 0);

    const walletCredit = sumTxn(AccountTxnType.WALLET_CREDIT);
    const walletDebit = sumTxn(AccountTxnType.WALLET_DEBIT);
    const debtAdd = sumTxn(AccountTxnType.DEBT_ADD);
    const debtPay = sumTxn(AccountTxnType.DEBT_PAY);

    const receivableEmployeeDebt = Math.max(0, debtAdd - debtPay);
    const mandatoryWalletLiability = Math.max(0, walletCredit - walletDebit);

    const salesCashAgg = await this.prisma.sale.aggregate({
      where: { createdAt: { lt: endExclusive } },
      _sum: { cashPaid: true },
    });
    const accumulatedCashEstimate =
      (salesCashAgg._sum.cashPaid ?? 0) + debtPay + walletCredit;

    const totalAssets =
      accumulatedCashEstimate + inventoryValue + receivableEmployeeDebt;
    const totalLiabilities = mandatoryWalletLiability;
    const equity = totalAssets - totalLiabilities;

    return {
      asOf: new Date(endExclusive.getTime() - 1).toISOString(),
      assets: {
        cashEstimate: accumulatedCashEstimate,
        inventoryValue,
        receivableEmployeeDebt,
        total: totalAssets,
      },
      liabilities: {
        mandatoryWalletLiability,
        total: totalLiabilities,
      },
      equity: {
        total: equity,
      },
      notes: [
        'cashEstimate dihitung dari akumulasi cashPaid sale + debtPay + walletCredit.',
        'Biaya operasional dan pembelian stok belum dimodelkan, sehingga neraca bersifat estimasi operasional.',
      ],
    };
  }

  private async getEmployeeByCode(employeeCode: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { employeeCode },
    });
    if (!emp || !emp.isActive) {
      throw new BadRequestException('Pegawai tidak ditemukan / nonaktif');
    }
    return emp;
  }

  private async getGeneralCustomer() {
    // Represent pembeli umum sebagai 1 record employee khusus agar Sale.employeeId tetap terisi.
    // Pastikan employeeCode bersifat unique di schema.
    return this.prisma.employee.upsert({
      where: { employeeCode: 'GENERAL' },
      update: { isActive: true },
      create: {
        employeeCode: 'GENERAL',
        name: 'Pembeli Umum',
        email: 'general@waserda.local',
        isActive: true,
      },
    });
  }

  private async getGeneralCustomerTx(tx: Prisma.TransactionClient) {
    return tx.employee.upsert({
      where: { employeeCode: 'GENERAL' },
      update: { isActive: true },
      create: {
        employeeCode: 'GENERAL',
        name: 'Pembeli Umum',
        email: 'general@waserda.local',
        isActive: true,
      },
    });
  }

  private async getEmployeeWalletBalanceTx(
    tx: Prisma.TransactionClient,
    employeeId: string,
  ): Promise<number> {
    const sums = await tx.accountTxn.groupBy({
      by: ['type'],
      where: { employeeId },
      _sum: { amount: true },
    });
    const find = (type: AccountTxnType) =>
      sums.find((x) => x.type === type)?._sum.amount ?? 0;
    return find(AccountTxnType.WALLET_CREDIT) - find(AccountTxnType.WALLET_DEBIT);
  }

  private calcUnitFinalPrice(price: number, discountPct: number, taxPct: number) {
    const discountPerUnit = Math.trunc((price * discountPct) / 100);
    const taxablePerUnit = price - discountPerUnit;
    const taxPerUnit = Math.trunc((taxablePerUnit * taxPct) / 100);
    return taxablePerUnit + taxPerUnit;
  }

  async listSales(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [total, rows] = await Promise.all([
      this.prisma.sale.count(),
      this.prisma.sale.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          buyerType: true,
          total: true,
          cashPaid: true,
          paidByMandatory: true,
          addedDebt: true,
          note: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              name: true,
              employeeCode: true,
            },
          },
          items: { select: { qty: true } },
        },
      }),
    ]);

    return {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows: rows.map((r) => ({
        id: r.id,
        buyerType: r.buyerType,
        total: r.total,
        cashPaid: r.cashPaid,
        paidByMandatory: r.paidByMandatory,
        addedDebt: r.addedDebt,
        note: r.note,
        createdAt: r.createdAt,
        employee: r.employee,
        itemCount: r.items.reduce((sum, x) => sum + x.qty, 0),
      })),
    };
  }

  async getSaleDetail(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        employee: {
          select: { id: true, name: true, employeeCode: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, barcode: true, category: true },
            },
          },
        },
      },
    });
    if (!sale) throw new NotFoundException('Transaksi tidak ditemukan');

    const linkedTxns = await this.prisma.accountTxn.findMany({
      where: { refSaleId: sale.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        amount: true,
        note: true,
        createdAt: true,
      },
    });

    return {
      ...sale,
      linkedTxns,
    };
  }

  async updateSale(
    saleId: string,
    input: {
      buyerType: 'EMPLOYEE' | 'GENERAL';
      employeeCode?: string;
      useWallet?: boolean;
      cashPaid?: number;
      items: { productId: string; qty: number }[];
      note?: string;
    },
  ) {
    const {
      buyerType,
      employeeCode,
      useWallet = true,
      cashPaid = 0,
      items,
      note,
    } = input;

    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.sale.findUnique({
        where: { id: saleId },
        include: {
          items: true,
        },
      });
      if (!existing) throw new NotFoundException('Transaksi tidak ditemukan');

      // rollback efek transaksi lama terlebih dulu
      for (const it of existing.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.qty } },
        });
      }
      await tx.accountTxn.deleteMany({ where: { refSaleId: saleId } });

      const productIds = items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
      });
      if (products.length !== productIds.length) {
        throw new BadRequestException('Ada produk yang tidak valid / nonaktif');
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      let total = 0;
      for (const it of items) {
        const p = productMap.get(it.productId);
        if (!p) throw new BadRequestException('Produk tidak valid');
        if (p.stock < it.qty) {
          throw new BadRequestException(`Stok tidak cukup: ${p.name}`);
        }
        const unitFinal = this.calcUnitFinalPrice(p.price, p.discountPct, p.taxPct);
        total += unitFinal * it.qty;
      }

      let employeeId: string | null = null;
      let cashApplied = 0;
      let paidByMandatory = 0;
      let addedDebt = 0;
      let change = 0;

      if (buyerType === 'GENERAL') {
        if (!Number.isInteger(cashPaid) || cashPaid < total) {
          throw new BadRequestException(
            'cashPaid harus bilangan bulat dan >= total',
          );
        }
        const generalEmp = await this.getGeneralCustomerTx(tx);
        employeeId = generalEmp.id;
        cashApplied = total;
        change = cashPaid - total;
      } else {
        if (!employeeCode) {
          throw new BadRequestException(
            'employeeCode wajib untuk buyerType=EMPLOYEE',
          );
        }
        const emp = await tx.employee.findUnique({
          where: { employeeCode },
        });
        if (!emp || !emp.isActive) {
          throw new BadRequestException('Pegawai tidak ditemukan / nonaktif');
        }
        employeeId = emp.id;

        if (!Number.isInteger(cashPaid) || cashPaid < 0) {
          throw new BadRequestException('cashPaid harus bilangan bulat dan >= 0');
        }
        const walletBalance = await this.getEmployeeWalletBalanceTx(tx, emp.id);
        paidByMandatory = useWallet
          ? Math.max(0, Math.min(walletBalance, total))
          : 0;
        const remainingAfterWallet = total - paidByMandatory;
        cashApplied = Math.max(0, Math.min(cashPaid, remainingAfterWallet));
        addedDebt = remainingAfterWallet - cashApplied;
        change = cashPaid - cashApplied;
      }

      for (const it of items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        });
      }

      await tx.saleItem.deleteMany({ where: { saleId } });
      await tx.saleItem.createMany({
        data: items.map((it) => {
          const p = productMap.get(it.productId)!;
          return {
            saleId,
            productId: p.id,
            qty: it.qty,
            price: this.calcUnitFinalPrice(p.price, p.discountPct, p.taxPct),
          };
        }),
      });

      await tx.sale.update({
        where: { id: saleId },
        data: {
          buyerType,
          employeeId,
          total,
          cashPaid: cashApplied,
          paidByMandatory,
          addedDebt,
          source: SaleSource.CASHIER_WEB,
          note: note?.trim() || null,
        },
      });

      if (buyerType === 'EMPLOYEE' && employeeId) {
        if (paidByMandatory > 0) {
          await tx.accountTxn.create({
            data: {
              employeeId,
              type: AccountTxnType.WALLET_DEBIT,
              amount: paidByMandatory,
              refSaleId: saleId,
              note: note ? `SALE_EDIT:${note}` : 'SALE_EDIT',
            },
          });
        }
        if (addedDebt > 0) {
          await tx.accountTxn.create({
            data: {
              employeeId,
              type: AccountTxnType.DEBT_ADD,
              amount: addedDebt,
              refSaleId: saleId,
              note: note ? `DEBT_FROM_SALE_EDIT:${note}` : 'DEBT_FROM_SALE_EDIT',
            },
          });
        }
      }

      return {
        ok: true,
        saleId,
        buyerType,
        total,
        cashPaid,
        change,
        paidByMandatory,
        addedDebt,
      };
    });
  }

  async deleteSale(saleId: string) {
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });
      if (!sale) throw new NotFoundException('Transaksi tidak ditemukan');

      for (const it of sale.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.qty } },
        });
      }
      await tx.accountTxn.deleteMany({ where: { refSaleId: saleId } });
      await tx.sale.delete({ where: { id: saleId } });

      return {
        ok: true,
        saleId,
        restoredItems: sale.items.length,
      };
    });
  }

  async getEmployeeBalanceByCode(employeeCode: string) {
    const emp = await this.getEmployeeByCode(employeeCode);

    const sums = await this.prisma.accountTxn.groupBy({
      by: ['type'],
      where: { employeeId: emp.id },
      _sum: { amount: true },
    });

    const sum = (t: AccountTxnType) =>
      sums.find((s) => s.type === t)?._sum.amount ?? 0;

    const wallet =
      sum(AccountTxnType.WALLET_CREDIT) - sum(AccountTxnType.WALLET_DEBIT);
    const debt = sum(AccountTxnType.DEBT_ADD) - sum(AccountTxnType.DEBT_PAY);

    return {
      employee: { id: emp.id, name: emp.name, employeeCode: emp.employeeCode },
      walletBalance: wallet,
      debtBalance: debt,
    };
  }

  async getEmployeeSaleHistory(employeeCode: string, take = 30) {
    const emp = await this.getEmployeeByCode(employeeCode);

    const sales = await this.prisma.sale.findMany({
      where: {
        employeeId: emp.id,
        buyerType: 'EMPLOYEE',
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
      select: {
        id: true,
        createdAt: true,
        total: true,
        cashPaid: true,
        paidByMandatory: true,
        addedDebt: true,
        items: {
          select: {
            qty: true,
            price: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return sales.map((sale) => ({
      saleId: sale.id,
      createdAt: sale.createdAt,
      total: sale.total,
      cashPaid: sale.cashPaid,
      paidByMandatory: sale.paidByMandatory,
      addedDebt: sale.addedDebt,
      itemCount: sale.items.reduce((sum, item) => sum + item.qty, 0),
      items: sale.items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        qty: item.qty,
        price: item.price,
      })),
    }));
  }

  async getWalletMonitor(q?: string) {
    const where = q?.trim()
      ? {
          employeeCode: { not: 'GENERAL' },
          OR: [
            { name: { contains: q.trim(), mode: 'insensitive' as const } },
            {
              employeeCode: {
                contains: q.trim(),
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : { employeeCode: { not: 'GENERAL' } };

    const employees = await this.prisma.employee.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        role: true,
        isActive: true,
      },
    });

    if (employees.length === 0) return [];

    const ids = employees.map((e) => e.id);
    const sums = await this.prisma.accountTxn.groupBy({
      by: ['employeeId', 'type'],
      where: { employeeId: { in: ids } },
      _sum: { amount: true },
    });
    const lastWalletTxn = await this.prisma.accountTxn.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: ids },
        type: {
          in: [AccountTxnType.WALLET_CREDIT, AccountTxnType.WALLET_DEBIT],
        },
      },
      _max: { createdAt: true },
    });

    const byEmployee = new Map<string, Record<string, number>>();
    for (const row of sums) {
      const prev = byEmployee.get(row.employeeId) ?? {};
      prev[row.type] = row._sum.amount ?? 0;
      byEmployee.set(row.employeeId, prev);
    }
    const lastTxnByEmployee = new Map(
      lastWalletTxn.map((row) => [row.employeeId, row._max.createdAt ?? null]),
    );

    return employees.map((e) => {
      const s = byEmployee.get(e.id) ?? {};
      const wallet =
        (s[AccountTxnType.WALLET_CREDIT] ?? 0) -
        (s[AccountTxnType.WALLET_DEBIT] ?? 0);
      const debt =
        (s[AccountTxnType.DEBT_ADD] ?? 0) - (s[AccountTxnType.DEBT_PAY] ?? 0);
      return {
        employee: e,
        walletBalance: wallet,
        debtBalance: debt,
        lastWalletTxnAt: lastTxnByEmployee.get(e.id) ?? null,
      };
    });
  }

  async getWalletHistory(employeeCode?: string, take = 50) {
    const code = employeeCode?.trim();
    const where = code
      ? {
          type: {
            in: [AccountTxnType.WALLET_CREDIT, AccountTxnType.WALLET_DEBIT],
          },
          employee: {
            employeeCode: code,
          },
        }
      : {
          type: {
            in: [AccountTxnType.WALLET_CREDIT, AccountTxnType.WALLET_DEBIT],
          },
          employee: {
            employeeCode: { not: 'GENERAL' },
          },
        };

    const txns = await this.prisma.accountTxn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
      select: {
        id: true,
        type: true,
        amount: true,
        note: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            name: true,
            employeeCode: true,
          },
        },
      },
    });

    return txns.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      note: t.note,
      createdAt: t.createdAt,
      employee: t.employee,
    }));
  }

  async adjustWallet(
    employeeCode: string,
    mode: 'ADD' | 'SUB' | 'SET',
    amount: number,
    note?: string,
  ) {
    const emp = await this.getEmployeeByCode(employeeCode);
    if (!Number.isInteger(amount) || amount < 0) {
      throw new BadRequestException('Amount harus bilangan bulat >= 0');
    }

    const current = await this.getEmployeeBalanceByCode(employeeCode);
    const before = current.walletBalance;

    let delta = 0;
    if (mode === 'ADD') delta = amount;
    if (mode === 'SUB') delta = -amount;
    if (mode === 'SET') delta = amount - before;

    if (before + delta < 0) {
      throw new BadRequestException('Saldo wajib tidak boleh menjadi minus');
    }

    if (delta !== 0) {
      await this.prisma.accountTxn.create({
        data: {
          employeeId: emp.id,
          type: delta > 0 ? AccountTxnType.WALLET_CREDIT : AccountTxnType.WALLET_DEBIT,
          amount: Math.abs(delta),
          note:
            note?.trim() ||
            `ADMIN_WALLET_${mode}:${amount}`,
        },
      });
    }

    const after = await this.getEmployeeBalanceByCode(employeeCode);
    return {
      ok: true,
      employee: {
        id: emp.id,
        name: emp.name,
        employeeCode: emp.employeeCode,
      },
      walletBefore: before,
      walletAfter: after.walletBalance,
      mode,
      amount,
      delta,
    };
  }

  async createSale(input: {
    buyerType: 'EMPLOYEE' | 'GENERAL';
    employeeCode?: string;
    useWallet?: boolean;
    cashPaid?: number;
    items: { productId: string; qty: number }[];
    note?: string;
  }) {
    const {
      buyerType,
      employeeCode,
      useWallet = true,
      cashPaid = 0,
      items,
      note,
    } = input;

    // --- ambil produk & validasi stok sama seperti sebelumnya ---
    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Ada produk yang tidak valid / nonaktif');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    let total = 0;

    for (const it of items) {
      const p = productMap.get(it.productId);
      if (!p) throw new BadRequestException('Produk tidak valid');
      if (p.stock < it.qty)
        throw new BadRequestException(`Stok tidak cukup: ${p.name}`);
      const base = p.price * it.qty;
      const discount = Math.trunc((base * p.discountPct) / 100);
      const taxable = base - discount;
      const tax = Math.trunc((taxable * p.taxPct) / 100);
      total += taxable + tax;
    }

    // ===== CASE 1: BUYER UMUM =====
    if (buyerType === 'GENERAL') {
      if (!Number.isInteger(cashPaid) || cashPaid < total) {
        throw new BadRequestException(
          'cashPaid harus bilangan bulat dan >= total',
        );
      }

      const change = cashPaid - total;

      const generalEmp = await this.getGeneralCustomer();

      const result = await this.prisma.$transaction(async (tx) => {
        // kurangi stok produk
        for (const it of items) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: it.qty } },
          });
        }

        const sale = await tx.sale.create({
          data: {
            buyerType: 'GENERAL',
            employeeId: generalEmp.id,
            total,
            cashPaid: total,
            paidByMandatory: 0,
            addedDebt: 0,
            source: SaleSource.CASHIER_WEB,
            note: note?.trim() || null,
            items: {
              create: items.map((it) => {
                const p = productMap.get(it.productId)!;
                const discountPerUnit = Math.trunc(
                  (p.price * p.discountPct) / 100,
                );
                const taxablePerUnit = p.price - discountPerUnit;
                const taxPerUnit = Math.trunc(
                  (taxablePerUnit * p.taxPct) / 100,
                );
                const finalUnitPrice = taxablePerUnit + taxPerUnit;
                return { productId: p.id, qty: it.qty, price: finalUnitPrice };
              }),
            },
          },
        });

        return sale;
      });

      return {
        saleId: result.id,
        buyerType: 'GENERAL',
        total,
        cashPaid,
        change,
        paidByMandatory: 0,
        addedDebt: 0,
      };
    }

    // ===== CASE 2: BUYER PEGAWAI =====
    if (!employeeCode)
      throw new BadRequestException(
        'employeeCode wajib untuk buyerType=EMPLOYEE',
      );

    const emp = await this.getEmployeeByCode(employeeCode);

    if (!Number.isInteger(cashPaid) || cashPaid < 0) {
      throw new BadRequestException('cashPaid harus bilangan bulat dan >= 0');
    }

    const bal = await this.getEmployeeBalanceByCode(employeeCode);
    const walletBalance = bal.walletBalance;

    // saldo wajib (wallet) boleh dipakai atau tidak
    const walletApplied = useWallet
      ? Math.max(0, Math.min(walletBalance, total))
      : 0;

    // setelah potong saldo, bisa dibayar tunai sebagian / penuh
    const remainingAfterWallet = total - walletApplied;
    const cashApplied = Math.max(0, Math.min(cashPaid, remainingAfterWallet));

    // kalau masih kurang, jadi hutang
    const addedDebt = remainingAfterWallet - cashApplied;

    // kalau tunai berlebih dari sisa setelah wallet, kembalian
    const change = cashPaid - cashApplied;

    const result = await this.prisma.$transaction(async (tx) => {
      for (const it of items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.qty } },
        });
      }

      const sale = await tx.sale.create({
        data: {
          buyerType: 'EMPLOYEE',
          employeeId: emp.id,
          total,
          cashPaid: cashApplied,
          paidByMandatory: walletApplied,
          addedDebt,
          source: SaleSource.CASHIER_WEB,
          note: note?.trim() || null,
          items: {
            create: items.map((it) => {
              const p = productMap.get(it.productId)!;
              const discountPerUnit = Math.trunc(
                (p.price * p.discountPct) / 100,
              );
              const taxablePerUnit = p.price - discountPerUnit;
              const taxPerUnit = Math.trunc((taxablePerUnit * p.taxPct) / 100);
              const finalUnitPrice = taxablePerUnit + taxPerUnit;
              return { productId: p.id, qty: it.qty, price: finalUnitPrice };
            }),
          },
        },
      });

      if (walletApplied > 0) {
        await tx.accountTxn.create({
          data: {
            employeeId: emp.id,
            type: AccountTxnType.WALLET_DEBIT,
            amount: walletApplied,
            refSaleId: sale.id,
            note: note ? `SALE:${note}` : 'SALE',
          },
        });
      }

      if (addedDebt > 0) {
        await tx.accountTxn.create({
          data: {
            employeeId: emp.id,
            type: AccountTxnType.DEBT_ADD,
            amount: addedDebt,
            refSaleId: sale.id,
            note: note ? `DEBT_FROM_SALE:${note}` : 'DEBT_FROM_SALE',
          },
        });
      }

      return sale;
    });

    return {
      saleId: result.id,
      buyerType: 'EMPLOYEE',
      employee: { id: emp.id, name: emp.name, employeeCode: emp.employeeCode },
      total,
      cashPaid,
      change,
      paidByMandatory: walletApplied,
      addedDebt,
    };
  }

  async payDebt(employeeCode: string, amount: number, note?: string) {
    const emp = await this.getEmployeeByCode(employeeCode);

    const bal = await this.getEmployeeBalanceByCode(employeeCode);
    const debt = bal.debtBalance;

    if (debt <= 0) {
      throw new BadRequestException('Pegawai tidak memiliki hutang');
    }
    if (amount > debt) {
      throw new BadRequestException(
        `Nominal melebihi hutang. Hutang saat ini: ${debt}`,
      );
    }

    await this.prisma.accountTxn.create({
      data: {
        employeeId: emp.id,
        type: AccountTxnType.DEBT_PAY,
        amount,
        note: note ? `DEBT_PAY:${note}` : 'DEBT_PAY',
      },
    });

    const after = await this.getEmployeeBalanceByCode(employeeCode);
    return { ok: true, debtBefore: debt, debtAfter: after.debtBalance };
  }

  // ✅ TAMBAH STOK (barang masuk)
  async stockIn(
    productId: string,
    qty: number,
    _note: string,
  ): Promise<{ ok: boolean; productId: string; stockAfter: number }> {
    void _note;
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!p) throw new BadRequestException('Produk tidak ditemukan');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
      });

      return { ok: true, productId, stockAfter: updated.stock };
    });
  }

  // ✅ SESUAIKAN STOK (bisa + / -)
  async stockAdjust(
    productId: string,
    qty: number,
    _note: string,
  ): Promise<{
    ok: boolean;
    productId: string;
    stockBefore: number;
    stockAfter: number;
  }> {
    void _note;
    if (qty === 0) throw new BadRequestException('Qty tidak boleh 0');

    const p = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!p) throw new BadRequestException('Produk tidak ditemukan');

    const after = p.stock + qty;
    if (after < 0) throw new BadRequestException('Stok tidak boleh minus');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: after },
      });

      return {
        ok: true,
        productId,
        stockBefore: p.stock,
        stockAfter: updated.stock,
      };
    });
  }
}
