import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashierController } from './cashier.controller';
import { CashierReportExportService } from './cashier-report-export.service';
import { CashierService } from './cashier.service';

@Module({
  controllers: [CashierController],
  providers: [CashierService, CashierReportExportService, PrismaService],
})
export class CashierModule {}
