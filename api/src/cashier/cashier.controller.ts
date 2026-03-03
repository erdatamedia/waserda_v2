import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod.pipe';
import { CashierService } from './cashier.service';

type CreateSaleBody = {
  buyerType: 'EMPLOYEE' | 'GENERAL';
  employeeCode?: string;
  useWallet?: boolean;
  cashPaid?: number;
  items: { productId: string; qty: number }[];
  note?: string;
};

type DebtPayBody = {
  employeeCode: string;
  amount: number;
  note?: string;
};

type StockInBody = {
  productId: string;
  qty: number;
  note: string;
};

type StockAdjustBody = {
  productId: string;
  qty: number;
  note: string;
};

type WalletAdjustBody = {
  employeeCode: string;
  mode: 'ADD' | 'SUB' | 'SET';
  amount: number;
  note?: string;
};

const CreateSaleSchema = z
  .object({
    buyerType: z.enum(['EMPLOYEE', 'GENERAL']),
    employeeCode: z.string().min(3).optional(),
    useWallet: z.boolean().optional(),
    cashPaid: z.number().int().nonnegative().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          qty: z.number().int().positive(),
        }),
      )
      .min(1),
    note: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.buyerType === 'EMPLOYEE') {
      if (!val.employeeCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'employeeCode wajib untuk buyerType=EMPLOYEE',
          path: ['employeeCode'],
        });
      }
    }

    if (val.buyerType === 'GENERAL') {
      if (val.cashPaid === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'cashPaid wajib untuk buyerType=GENERAL',
          path: ['cashPaid'],
        });
      }
    }
  });

const DebtPaySchema = z.object({
  employeeCode: z.string().min(3),
  amount: z.number().int().positive(),
  note: z.string().optional(),
});

const StockInSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  note: z.string().min(3),
});

const StockAdjustSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int(), // boleh negatif/positif
  note: z.string().min(3),
});

const WalletAdjustSchema = z.object({
  employeeCode: z.string().min(3),
  mode: z.enum(['ADD', 'SUB', 'SET']),
  amount: z.number().int().nonnegative(),
  note: z.string().optional(),
});

const UpdateSaleSchema = z
  .object({
    buyerType: z.enum(['EMPLOYEE', 'GENERAL']),
    employeeCode: z.string().min(3).optional(),
    useWallet: z.boolean().optional(),
    cashPaid: z.number().int().nonnegative().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          qty: z.number().int().positive(),
        }),
      )
      .min(1),
    note: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.buyerType === 'EMPLOYEE' && !val.employeeCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'employeeCode wajib untuk buyerType=EMPLOYEE',
        path: ['employeeCode'],
      });
    }
    if (val.buyerType === 'GENERAL' && val.cashPaid === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'cashPaid wajib untuk buyerType=GENERAL',
        path: ['cashPaid'],
      });
    }
  });

@Controller('cashier')
export class CashierController {
  constructor(private readonly cashier: CashierService) {}

  private parseDateOrThrow(raw: string | undefined, field: string): Date {
    if (!raw) {
      throw new BadRequestException(`${field} wajib diisi`);
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${field} tidak valid`);
    }
    return d;
  }

  @Get('summary/dashboard')
  dashboardSummary() {
    return this.cashier.getDashboardSummary();
  }

  @Get('summary/today')
  todaySummary() {
    return this.cashier.getTodaySummary();
  }

  @Get('reports/financial')
  financialReport(
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = fromRaw ? this.parseDateOrThrow(fromRaw, 'from') : defaultFrom;
    const to = toRaw ? this.parseDateOrThrow(toRaw, 'to') : now;
    return this.cashier.getFinancialReport(from, to);
  }

  @Get('reports/balance-sheet')
  balanceSheet(@Query('asOf') asOfRaw?: string) {
    const asOf = asOfRaw ? this.parseDateOrThrow(asOfRaw, 'asOf') : undefined;
    return this.cashier.getBalanceSheet(asOf);
  }

  @Get('reports/financial/export')
  async exportFinancialReport(
    @Query('from') fromRaw: string | undefined,
    @Query('to') toRaw: string | undefined,
    @Res() res: Response,
  ) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = fromRaw ? this.parseDateOrThrow(fromRaw, 'from') : defaultFrom;
    const to = toRaw ? this.parseDateOrThrow(toRaw, 'to') : now;

    const report = await this.cashier.getFinancialReport(from, to);
    const rows: string[][] = [
      ['section', 'metric', 'value'],
      ['period', 'from', report.period.from],
      ['period', 'to', report.period.to],
      ['sales', 'transactionCount', String(report.sales.transactionCount)],
      ['sales', 'totalSales', String(report.sales.totalSales)],
      ['sales', 'employeeSales', String(report.sales.employeeSales)],
      ['sales', 'generalSales', String(report.sales.generalSales)],
      ['movements', 'cashFromSales', String(report.movements.cashFromSales)],
      ['movements', 'walletUsed', String(report.movements.walletUsed)],
      [
        'movements',
        'debtAddedFromSales',
        String(report.movements.debtAddedFromSales),
      ],
      ['movements', 'debtPayment', String(report.movements.debtPayment)],
      [
        'movements',
        'walletTopupCredit',
        String(report.movements.walletTopupCredit),
      ],
      ['ledgerSummary', 'debtAdd', String(report.ledgerSummary.debtAdd)],
      ['ledgerSummary', 'debtPay', String(report.ledgerSummary.debtPay)],
      [
        'ledgerSummary',
        'walletCredit',
        String(report.ledgerSummary.walletCredit),
      ],
      ['ledgerSummary', 'walletDebit', String(report.ledgerSummary.walletDebit)],
      [
        'cashflowEstimate',
        'totalCashIn',
        String(report.cashflowEstimate.totalCashIn),
      ],
    ];
    const esc = (v: string) => {
      if (v.includes('"') || v.includes(',') || v.includes('\n')) {
        return `"${v.replaceAll('"', '""')}"`;
      }
      return v;
    };
    const csv = `${rows.map((r) => r.map(esc).join(',')).join('\n')}\n`;
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="financial-report-${stamp}.csv"`,
    );
    res.send(csv);
  }

  @Get('employee-balance')
  employeeBalance(@Query('employeeCode') employeeCode: string) {
    return this.cashier.getEmployeeBalanceByCode(employeeCode);
  }

  @Get('sales')
  sales(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    const p = Number(page);
    const s = Number(pageSize);
    const safePage = Number.isFinite(p) ? Math.max(1, Math.trunc(p)) : 1;
    const safePageSize = Number.isFinite(s)
      ? Math.min(100, Math.max(1, Math.trunc(s)))
      : 20;
    return this.cashier.listSales(safePage, safePageSize);
  }

  @Get('sales/:id')
  saleDetail(@Param('id') id: string) {
    return this.cashier.getSaleDetail(id);
  }

  @Patch('sales/:id')
  updateSale(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateSaleSchema))
    body: {
      buyerType: 'EMPLOYEE' | 'GENERAL';
      employeeCode?: string;
      useWallet?: boolean;
      cashPaid?: number;
      items: { productId: string; qty: number }[];
      note?: string;
    },
  ) {
    return this.cashier.updateSale(id, body);
  }

  @Delete('sales/:id')
  deleteSale(@Param('id') id: string) {
    return this.cashier.deleteSale(id);
  }

  @Get('employee-history')
  employeeHistory(
    @Query('employeeCode') employeeCode: string,
    @Query('take') take?: string,
  ) {
    const parsedTake = Number(take);
    const safeTake = Number.isFinite(parsedTake)
      ? Math.min(Math.max(Math.trunc(parsedTake), 1), 100)
      : 30;
    return this.cashier.getEmployeeSaleHistory(employeeCode, safeTake);
  }

  @Get('wallet-monitor')
  walletMonitor(@Query('q') q?: string) {
    return this.cashier.getWalletMonitor(q);
  }

  @Get('wallet-history')
  walletHistory(
    @Query('employeeCode') employeeCode?: string,
    @Query('take') take?: string,
  ) {
    const parsedTake = Number(take);
    const safeTake = Number.isFinite(parsedTake)
      ? Math.min(Math.max(Math.trunc(parsedTake), 1), 200)
      : 50;
    return this.cashier.getWalletHistory(employeeCode, safeTake);
  }

  @Post('sale')
  createSale(
    @Body(new ZodValidationPipe(CreateSaleSchema)) body: CreateSaleBody,
  ) {
    return this.cashier.createSale(body);
  }

  @Post('debt-pay')
  debtPay(@Body(new ZodValidationPipe(DebtPaySchema)) body: DebtPayBody) {
    return this.cashier.payDebt(body.employeeCode, body.amount, body.note);
  }

  @Post('stock-in')
  stockIn(@Body(new ZodValidationPipe(StockInSchema)) body: StockInBody) {
    return this.cashier.stockIn(body.productId, body.qty, body.note);
  }

  @Post('stock-adjust')
  stockAdjust(
    @Body(new ZodValidationPipe(StockAdjustSchema)) body: StockAdjustBody,
  ) {
    return this.cashier.stockAdjust(body.productId, body.qty, body.note);
  }

  @Post('wallet-adjust')
  walletAdjust(
    @Body(new ZodValidationPipe(WalletAdjustSchema))
    body: WalletAdjustBody,
  ) {
    return this.cashier.adjustWallet(
      body.employeeCode,
      body.mode,
      body.amount,
      body.note,
    );
  }
}
