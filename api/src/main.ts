import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow larger JSON/form payloads for product image uploads (base64 data URL).
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  app.enableCors({
    origin: [
      'http://localhost:3001',
      'http://127.0.0.1:3001',
      'http://192.168.1.3:3001', // dari log Next kamu
    ],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3000);
}
void bootstrap();
