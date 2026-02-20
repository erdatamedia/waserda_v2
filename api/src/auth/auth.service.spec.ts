import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    employee: {
      findUnique: jest.Mock;
    };
  };
  let jwtService: {
    signAsync: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('EMPLOYEE login via mobile -> success', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      name: 'Employee One',
      employeeCode: 'EMP-0001',
      role: Role.EMPLOYEE,
      isActive: true,
    });

    const res = await service.login('EMP-0001', 'mobile');

    expect(res).toEqual({
      accessToken: 'jwt-token',
      employee: {
        id: 'emp-1',
        name: 'Employee One',
        employeeCode: 'EMP-0001',
        role: Role.EMPLOYEE,
        isActive: true,
      },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'emp-1',
      role: Role.EMPLOYEE,
    });
  });

  it('EMPLOYEE login via web -> 403', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      name: 'Employee One',
      employeeCode: 'EMP-0001',
      role: Role.EMPLOYEE,
      isActive: true,
    });

    await expect(service.login('EMP-0001', 'web')).rejects.toThrow(
      ForbiddenException,
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('CASHIER login via web -> success', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'csr-1',
      name: 'Cashier One',
      employeeCode: 'CSR-0001',
      role: Role.CASHIER,
      isActive: true,
    });

    const res = await service.login('CSR-0001', 'web');

    expect(res).toEqual({
      accessToken: 'jwt-token',
      employee: {
        id: 'csr-1',
        name: 'Cashier One',
        employeeCode: 'CSR-0001',
        role: Role.CASHIER,
        isActive: true,
      },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'csr-1',
      role: Role.CASHIER,
    });
  });
});
