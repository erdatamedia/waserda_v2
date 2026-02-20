import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod.pipe';
import { MasterService } from './master.service';

const CategoryCodeSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[A-Z0-9_]+$/);

const CreateCategorySchema = z.object({
  code: CategoryCodeSchema,
  name: z.string().min(2),
  isActive: z.boolean().optional(),
});

const UpdateCategorySchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

@Controller('master')
export class MasterController {
  constructor(private readonly master: MasterService) {}

  @Get('categories')
  listCategories() {
    return this.master.listCategories();
  }

  @Patch('categories/:code')
  updateCategory(
    @Param('code') code: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema))
    body: { name?: string; isActive?: boolean },
  ) {
    const parsed = CategoryCodeSchema.parse(code.toUpperCase());
    return this.master.updateCategory(parsed, body);
  }

  @Post('categories')
  createCategory(
    @Body(new ZodValidationPipe(CreateCategorySchema))
    body: {
      code: string;
      name: string;
      isActive?: boolean;
    },
  ) {
    return this.master.createCategory(body);
  }
}
