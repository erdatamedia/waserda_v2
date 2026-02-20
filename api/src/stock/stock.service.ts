import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// NOTE: Avoid Prisma payload helper types here because ESLint type-checking may
// treat some Prisma-generated helper types (e.g. `StockTxnDefaultArgs`) as an
// `error` type. Keep these DTO-like shapes stable.
export interface StockTxnRow {
  id: string;
  productId: string;
  type: string;
  qty: number;
  note: string | null;
  createdAt: Date;
}

export interface StockTxnWithProduct extends StockTxnRow {
  product: Product;
}

// Use string literals for enum values (works with Prisma enum fields)
const STOCK_TXN_IN = 'IN' as const;
const STOCK_TXN_ADJUST = 'ADJUST' as const;

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  // Helpers to keep ESLint happy when Prisma types temporarily degrade to `error`/`any`
  private async stockTxnCreate(
    tx: Prisma.TransactionClient,
    args: Prisma.StockTxnCreateArgs,
  ): Promise<unknown> {
    const create = (
      tx.stockTxn as unknown as {
        create: (a: Prisma.StockTxnCreateArgs) => Promise<unknown>;
      }
    ).create;
    return await create(args);
  }

  private async stockTxnFindMany(
    args: Prisma.StockTxnFindManyArgs,
  ): Promise<unknown> {
    const findMany = (
      this.prisma.stockTxn as unknown as {
        findMany: (a: Prisma.StockTxnFindManyArgs) => Promise<unknown>;
      }
    ).findMany;
    return await findMany(args);
  }

  async listProducts(includeInactive = false): Promise<Product[]> {
    return await this.prisma.product.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getProduct(productId: string): Promise<Product> {
    const p = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!p) throw new NotFoundException('Produk tidak ditemukan');
    return p;
  }

  async createProduct(input: {
    name: string;
    category?: string;
    imageUrl?: string;
    barcode?: string;
    price: number;
    discountPct?: number;
    taxPct?: number;
    stock?: number;
    isActive?: boolean;
  }): Promise<Product> {
    const name = input.name?.trim();
    if (!name || name.length < 2)
      throw new BadRequestException('Nama produk tidak valid');
    if (!Number.isFinite(input.price) || input.price < 0)
      throw new BadRequestException('Harga tidak valid');
    if ((input.category?.trim() ?? '').length === 0) {
      throw new BadRequestException('Kategori tidak valid');
    }
    if ((input.discountPct ?? 0) < 0 || (input.discountPct ?? 0) > 100) {
      throw new BadRequestException('Diskon harus 0..100');
    }
    if ((input.taxPct ?? 0) < 0 || (input.taxPct ?? 0) > 100) {
      throw new BadRequestException('Pajak harus 0..100');
    }
    if ((input.stock ?? 0) < 0)
      throw new BadRequestException('Stok awal tidak boleh minus');

    return await this.prisma.product.create({
      data: {
        name,
        category: input.category?.trim() || 'OTHER',
        imageUrl: input.imageUrl?.trim() || null,
        barcode: input.barcode?.trim() || null,
        price: Math.trunc(input.price),
        discountPct: Math.trunc(input.discountPct ?? 0),
        taxPct: Math.trunc(input.taxPct ?? 0),
        stock: input.stock ?? 0,
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateProduct(
    productId: string,
    input: {
      name?: string;
      category?: string;
      imageUrl?: string;
      barcode?: string;
      price?: number;
      discountPct?: number;
      taxPct?: number;
      isActive?: boolean;
    },
  ): Promise<Product> {
    await this.getProduct(productId);

    if (input.name !== undefined && input.name.trim().length < 2) {
      throw new BadRequestException('Nama produk tidak valid');
    }
    if (
      input.price !== undefined &&
      (!Number.isFinite(input.price) || input.price < 0)
    ) {
      throw new BadRequestException('Harga tidak valid');
    }
    if (
      input.discountPct !== undefined &&
      (input.discountPct < 0 || input.discountPct > 100)
    ) {
      throw new BadRequestException('Diskon harus 0..100');
    }
    if (
      input.taxPct !== undefined &&
      (input.taxPct < 0 || input.taxPct > 100)
    ) {
      throw new BadRequestException('Pajak harus 0..100');
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.category !== undefined
          ? { category: input.category.trim() || 'OTHER' }
          : {}),
        ...(input.imageUrl !== undefined
          ? { imageUrl: input.imageUrl.trim() || null }
          : {}),
        ...(input.barcode !== undefined
          ? { barcode: input.barcode.trim() || null }
          : {}),
        ...(input.price !== undefined
          ? { price: Math.trunc(input.price) }
          : {}),
        ...(input.discountPct !== undefined
          ? { discountPct: Math.trunc(input.discountPct) }
          : {}),
        ...(input.taxPct !== undefined
          ? { taxPct: Math.trunc(input.taxPct) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  async stockIn(
    productId: string,
    qty: number,
    note?: string,
  ): Promise<{
    ok: true;
    productId: string;
    stockBefore: number;
    stockAfter: number;
  }> {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new BadRequestException('Qty harus bilangan bulat > 0');
    }

    const p = await this.getProduct(productId);

    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: { increment: qty } },
        });

        await this.stockTxnCreate(tx, {
          data: {
            productId,
            // Use literal enum value to keep types stable even if enum export changes
            type: STOCK_TXN_IN,
            qty,
            note: note?.trim() || `STOCK_IN:${p.name}`,
          },
        });

        return {
          ok: true as const,
          productId,
          stockBefore: p.stock,
          stockAfter: updated.stock,
        };
      },
    );
  }

  async stockAdjust(
    productId: string,
    qty: number,
    note: string,
  ): Promise<{
    ok: true;
    productId: string;
    stockBefore: number;
    stockAfter: number;
  }> {
    if (!Number.isInteger(qty) || qty === 0) {
      throw new BadRequestException(
        'Qty harus bilangan bulat dan tidak boleh 0',
      );
    }
    if (!note || note.trim().length < 3) {
      throw new BadRequestException('Note minimal 3 karakter');
    }

    const p = await this.getProduct(productId);
    const after = p.stock + qty;
    if (after < 0) throw new BadRequestException('Stok tidak boleh minus');

    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updated = await tx.product.update({
          where: { id: productId },
          data: { stock: after },
        });

        await this.stockTxnCreate(tx, {
          data: {
            productId,
            type: STOCK_TXN_ADJUST,
            qty,
            note: note.trim(),
          },
        });

        return {
          ok: true as const,
          productId,
          stockBefore: p.stock,
          stockAfter: updated.stock,
        };
      },
    );
  }

  async stockHistory(productId: string, take = 50): Promise<StockTxnRow[]> {
    await this.getProduct(productId);
    const rows = await this.stockTxnFindMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
    });

    return rows as StockTxnRow[];
  }

  async latestStockTxns(take = 100): Promise<StockTxnWithProduct[]> {
    const rows = await this.stockTxnFindMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
      include: { product: true },
    });

    return rows as StockTxnWithProduct[];
  }
}
