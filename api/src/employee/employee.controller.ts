import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Param,
} from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod.pipe';
import { EmployeeService } from './employee.service';

const RoleSchema = z.enum(['ADMIN', 'CASHIER', 'EMPLOYEE']);

const CreateEmployeeSchema = z.object({
  name: z.string().min(2),
  employeeCode: z.string().min(3),
  email: z.string().email().optional().or(z.literal('')),
  role: RoleSchema.optional(),
  isActive: z.boolean().optional(),
});

const UpdateEmployeeSchema = z.object({
  name: z.string().min(2).optional(),
  employeeCode: z.string().min(3).optional(),
  email: z.string().email().optional().or(z.literal('')),
  role: RoleSchema.optional(),
  isActive: z.boolean().optional(),
});

@Controller('employees')
export class EmployeeController {
  constructor(private readonly employees: EmployeeService) {}

  @Get()
  list(@Query('all') all?: string) {
    const includeInactive = all === '1' || all === 'true' || all === undefined;
    return this.employees.listEmployees(includeInactive);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateEmployeeSchema))
    body: {
      name: string;
      employeeCode: string;
      email?: string;
      role?: 'ADMIN' | 'CASHIER' | 'EMPLOYEE';
      isActive?: boolean;
    },
  ) {
    return this.employees.createEmployee(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateEmployeeSchema))
    body: {
      name?: string;
      employeeCode?: string;
      email?: string;
      role?: 'ADMIN' | 'CASHIER' | 'EMPLOYEE';
      isActive?: boolean;
    },
  ) {
    return this.employees.updateEmployee(id, body);
  }
}
