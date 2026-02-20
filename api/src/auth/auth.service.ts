import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(employeeCodeRaw: string, clientType: 'web' | 'mobile') {
    const employeeCode = employeeCodeRaw?.trim() ?? '';
    if (!employeeCode) {
      throw new BadRequestException('employeeCode wajib diisi');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { employeeCode },
      select: {
        id: true,
        name: true,
        employeeCode: true,
        role: true,
        isActive: true,
      },
    });

    if (!employee) {
      throw new BadRequestException('Akun tidak ditemukan');
    }

    if (!employee.isActive) {
      throw new BadRequestException('Akun tidak aktif');
    }

    const allowedRolesByClient: Record<'web' | 'mobile', Role[]> = {
      web: [Role.ADMIN, Role.CASHIER],
      mobile: [Role.ADMIN, Role.CASHIER, Role.EMPLOYEE],
    };
    const allowedRoles = allowedRolesByClient[clientType];
    if (!allowedRoles.includes(employee.role)) {
      throw new ForbiddenException('Role tidak diizinkan untuk client ini');
    }

    const payload = {
      sub: employee.id,
      role: employee.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    console.log(
      `[LOGIN] employee=${employee.employeeCode} role=${employee.role} client=${clientType}`,
    );

    return {
      accessToken,
      employee,
    };
  }
}
