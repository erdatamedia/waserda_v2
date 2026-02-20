import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { CashierModule } from './cashier/cashier.module';
import { StockModule } from './stock/stock.module';
import { EmployeeModule } from './employee/employee.module';
import { MasterModule } from './master/master.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    CashierModule,
    StockModule,
    EmployeeModule,
    MasterModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
