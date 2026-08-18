import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  // Izoh: bufferLogs:true nestjs-pino bilan birga ishlamaydi (NestFactory.create
  // hech qachon resolve bo'lmaydi) — shuning uchun o'chirilgan. Pino barcha
  // so'rov loglarini baribir qayta ishlaydi.
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(Logger));

  // Telegram webhook — raw JSON body kerak.
  // Buni global json parser'dan OLDIN ro'yxatdan o'tkazamiz (path-specific middleware).
  app.use('/api/telegram/webhook', express.raw({ type: '*/*' }));

  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  app.get(Logger).log(`✅ Backend http://localhost:${port} portida ishga tushdi`);
}

void bootstrap();
