import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MasterService {
  constructor(private readonly prisma: PrismaService) {}

  private async categoryUpsert(input: {
    code: string;
    name: string;
    isActive: boolean;
  }): Promise<unknown> {
    const upsert = (
      this.prisma.productCategoryMaster as unknown as {
        upsert: (a: unknown) => Promise<unknown>;
      }
    ).upsert;
    return upsert({
      where: { code: input.code },
      update: {},
      create: input,
    });
  }

  private async categoryFindMany(): Promise<unknown> {
    const findMany = (
      this.prisma.productCategoryMaster as unknown as {
        findMany: (a: unknown) => Promise<unknown>;
      }
    ).findMany;
    return findMany({ orderBy: { code: 'asc' } });
  }

  private async categoryUpdate(
    code: string,
    data: { name?: string; isActive?: boolean },
  ): Promise<unknown> {
    const update = (
      this.prisma.productCategoryMaster as unknown as {
        update: (a: unknown) => Promise<unknown>;
      }
    ).update;
    return update({ where: { code }, data });
  }

  private async ensureCategoryDefaults() {
    const defaults: Array<{ code: string; name: string }> = [
      { code: 'DOG_FOOD', name: 'Kategori A' },
      { code: 'CAT_FOOD', name: 'Kategori B' },
      { code: 'OTHER', name: 'Lainnya' },
    ];

    for (const row of defaults) {
      await this.categoryUpsert({
        code: row.code,
        name: row.name,
        isActive: true,
      });
    }
  }

  async listCategories() {
    await this.ensureCategoryDefaults();
    return (await this.categoryFindMany()) as Array<{
      code: string;
      name: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }

  async createCategory(input: {
    code: string;
    name: string;
    isActive?: boolean;
  }) {
    await this.ensureCategoryDefaults();
    const code = input.code.trim().toUpperCase();
    const name = input.name.trim();
    const create = (
      this.prisma.productCategoryMaster as unknown as {
        create: (a: unknown) => Promise<unknown>;
      }
    ).create;
    return (await create({
      data: { code, name, isActive: input.isActive ?? true },
    })) as {
      code: string;
      name: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  }

  async updateCategory(
    code: string,
    input: { name?: string; isActive?: boolean },
  ) {
    await this.ensureCategoryDefaults();
    return (await this.categoryUpdate(code, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })) as {
      code: string;
      name: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  }
}
