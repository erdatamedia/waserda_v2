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

  exportProductsCsv(products: Product[]): string {
    const headers = [
      'id',
      'name',
      'category',
      'barcode',
      'price',
      'discountPct',
      'taxPct',
      'stock',
      'isActive',
      'imageUrl',
    ];
    const esc = (v: string | number | boolean | null | undefined) => {
      const raw = v === null || v === undefined ? '' : String(v);
      if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
        return `"${raw.replaceAll('"', '""')}"`;
      }
      return raw;
    };
    const lines = [headers.join(',')];
    for (const p of products) {
      lines.push(
        [
          p.id,
          p.name,
          p.category,
          p.barcode ?? '',
          p.price,
          p.discountPct,
          p.taxPct,
          p.stock,
          p.isActive ? 'true' : 'false',
          p.imageUrl ?? '',
        ]
          .map(esc)
          .join(','),
      );
    }
    return `${lines.join('\n')}\n`;
  }

  private parseCsvRows(csv: string): string[][] {
    const rows: string[][] = [];
    let cur = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
      const ch = csv[i];
      const next = csv[i + 1];
      if (ch === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(cur);
        cur = '';
      } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
        if (ch === '\r' && next === '\n') i++;
        row.push(cur);
        cur = '';
        if (row.some((x) => x.trim() !== '')) rows.push(row);
        row = [];
      } else {
        cur += ch;
      }
    }
    if (cur.length > 0 || row.length > 0) {
      row.push(cur);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
    }
    return rows;
  }

  async importProductsCsv(csv: string): Promise<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    errors: Array<{ row: number; message: string }>;
  }> {
    const rows = this.parseCsvRows(csv);
    if (rows.length < 2) {
      throw new BadRequestException('CSV tidak valid / tidak ada data');
    }

    const header = rows[0].map((x) => x.trim());
    const idx = (name: string) => header.findIndex((h) => h === name);
    const required = ['name', 'category', 'price', 'stock'];
    for (const f of required) {
      if (idx(f) < 0) {
        throw new BadRequestException(`Kolom wajib "${f}" tidak ditemukan`);
      }
    }

    const parseIntSafe = (v: string, def = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.trunc(n) : def;
    };
    const parseBoolSafe = (v: string, def = true) => {
      const s = v.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'no') return false;
      return def;
    };

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let r = 1; r < rows.length; r++) {
      const line = rows[r];
      const get = (name: string) => {
        const i = idx(name);
        return i >= 0 ? (line[i] ?? '').trim() : '';
      };

      const rowNo = r + 1;
      try {
        const id = get('id');
        const name = get('name');
        const category = get('category');
        const barcode = get('barcode');
        const imageUrl = get('imageUrl');
        const price = parseIntSafe(get('price'), -1);
        const discountPct = parseIntSafe(get('discountPct'), 0);
        const taxPct = parseIntSafe(get('taxPct'), 0);
        const stock = parseIntSafe(get('stock'), -1);
        const isActive = parseBoolSafe(get('isActive'), true);

        if (!name || name.length < 2) throw new Error('Nama minimal 2 karakter');
        if (!category) throw new Error('Kategori wajib diisi');
        if (price < 0) throw new Error('Price tidak valid');
        if (stock < 0) throw new Error('Stock tidak valid');

        let existing: Product | null = null;
        if (id) {
          existing = await this.prisma.product.findUnique({ where: { id } });
        }
        if (!existing && barcode) {
          existing = await this.prisma.product.findUnique({ where: { barcode } });
        }

        if (existing) {
          await this.updateProduct(existing.id, {
            name,
            category,
            barcode: barcode || undefined,
            imageUrl: imageUrl || undefined,
            price,
            discountPct,
            taxPct,
            isActive,
          });
          updated++;
        } else {
          await this.createProduct({
            name,
            category,
            barcode: barcode || undefined,
            imageUrl: imageUrl || undefined,
            price,
            discountPct,
            taxPct,
            stock,
            isActive,
          });
          created++;
        }
      } catch (e) {
        failed++;
        errors.push({
          row: rowNo,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      total: rows.length - 1,
      created,
      updated,
      failed,
      errors,
    };
  }
}
