import { Body, Controller, Headers, Post } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod.pipe';
import { AuthService } from './auth.service';

const LoginSchema = z.object({
  employeeCode: z.string().min(3),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(
    @Body(new ZodValidationPipe(LoginSchema))
    body: {
      employeeCode: string;
    },
    @Headers('x-client') clientHeader?: string,
  ) {
    const normalizedClient = clientHeader?.toLowerCase() === 'mobile' ? 'mobile' : 'web';
    return this.auth.login(body.employeeCode, normalizedClient);
  }
}
