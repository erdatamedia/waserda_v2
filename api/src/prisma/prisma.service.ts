import 'dotenv/config';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is missing. Check api/.env');

    const adapter = new PrismaPg({ connectionString: url });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
