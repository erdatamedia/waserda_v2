import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmployeeService {
  constructor(private readonly prisma: PrismaService) {}

  async listEmployees(includeInactive = true) {
    return this.prisma.employee.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        employeeCode: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async createEmployee(input: {
    name: string;
    employeeCode: string;
    email?: string;
    role?: Role;
    isActive?: boolean;
  }) {
    const name = input.name.trim();
    const employeeCode = input.employeeCode.trim();
    if (name.length < 2)
      throw new BadRequestException('Nama minimal 2 karakter');
    if (employeeCode.length < 3)
      throw new BadRequestException('Employee code minimal 3 karakter');

    return this.prisma.employee.create({
      data: {
        name,
        employeeCode,
        email: input.email?.trim() || null,
        role: input.role ?? 'EMPLOYEE',
        isActive: input.isActive ?? true,
      },
    });
  }

  async updateEmployee(
    id: string,
    input: {
      name?: string;
      employeeCode?: string;
      email?: string;
      role?: Role;
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pegawai tidak ditemukan');

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.employeeCode !== undefined
          ? { employeeCode: input.employeeCode.trim() }
          : {}),
        ...(input.email !== undefined
          ? { email: input.email.trim() || null }
          : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }
}
