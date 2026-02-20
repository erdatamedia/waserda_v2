import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod.pipe';
import { StockService } from './stock.service';

const ProductCategorySchema = z.string().min(1);

const CreateProductSchema = z.object({
  name: z.string().min(2),
  category: ProductCategorySchema.optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  barcode: z.string().min(3).optional().or(z.literal('')),
  price: z.number().int().nonnegative(),
  discountPct: z.number().int().min(0).max(100).optional(),
  taxPct: z.number().int().min(0).max(100).optional(),
  stock: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

const UpdateProductSchema = z.object({
  name: z.string().min(2).optional(),
  category: ProductCategorySchema.optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  barcode: z.string().min(3).optional().or(z.literal('')),
  price: z.number().int().nonnegative().optional(),
  discountPct: z.number().int().min(0).max(100).optional(),
  taxPct: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

const StockInSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  note: z.string().optional(),
});

const StockAdjustSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int(), // bisa + / -
  note: z.string().min(3),
});

@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  // list produk (default: aktif)
  @Get('products')
  listProducts(@Query('all') all?: string) {
    const includeInactive = all === '1' || all === 'true';
    return this.stock.listProducts(includeInactive);
  }

  // detail produk
  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.stock.getProduct(id);
  }

  // create produk
  @Post('products')
  createProduct(
    @Body(new ZodValidationPipe(CreateProductSchema))
    body: {
      name: string;
      category?: string;
      imageUrl?: string;
      barcode?: string;
      price: number;
      discountPct?: number;
      taxPct?: number;
      stock?: number;
      isActive?: boolean;
    },
  ) {
    return this.stock.createProduct(body);
  }

  // update produk
  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateProductSchema))
    body: {
      name?: string;
      category?: string;
      imageUrl?: string;
      barcode?: string;
      price?: number;
      discountPct?: number;
      taxPct?: number;
      isActive?: boolean;
    },
  ) {
    return this.stock.updateProduct(id, body);
  }

  // barang masuk
  @Post('in')
  stockIn(
    @Body(new ZodValidationPipe(StockInSchema))
    body: {
      productId: string;
      qty: number;
      note?: string;
    },
  ) {
    return this.stock.stockIn(body.productId, body.qty, body.note);
  }

  // koreksi stok (+/-)
  @Post('adjust')
  stockAdjust(
    @Body(new ZodValidationPipe(StockAdjustSchema))
    body: {
      productId: string;
      qty: number;
      note: string;
    },
  ) {
    return this.stock.stockAdjust(body.productId, body.qty, body.note);
  }

  // histori stok per produk
  @Get('history/:productId')
  history(@Param('productId') productId: string, @Query('take') take?: string) {
    const n = take ? Number(take) : 50;
    return this.stock.stockHistory(productId, Number.isFinite(n) ? n : 50);
  }

  // histori stok terbaru semua produk
  @Get('latest')
  latest(@Query('take') take?: string) {
    const n = take ? Number(take) : 100;
    return this.stock.latestStockTxns(Number.isFinite(n) ? n : 100);
  }
}
