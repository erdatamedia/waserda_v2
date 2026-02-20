import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashierController } from './cashier.controller';
import { CashierService } from './cashier.service';

@Module({
  controllers: [CashierController],
  providers: [CashierService, PrismaService],
})
export class CashierModule {}
