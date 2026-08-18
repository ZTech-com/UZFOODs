import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
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

  // ── Production: Next.js statik export'ni xizmat qilish ──
  // Frontend 'out/' papkasi backend bilan birga build qilinadi.
  // API route'lardan tashqari barcha so'rovlar index.html ga yo'naltiriladi (SPA).
  // Muhim: Buni app.listen() OLDIN ro'yxatdan o'tkazish kerak,
  // chunki Express middleware-lari ro'yxatdan o'tkazilish tartibida ishlaydi.
  const isProd = process.env.NODE_ENV === 'production';
  const frontendPath = process.env.FRONTEND_PATH
    ?? path.resolve(__dirname, '..', '..', 'frontend', 'out');
  if (isProd && fs.existsSync(frontendPath)) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(express.static(frontendPath));
    expressApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      // API route'larni NestJS'ga uzatish
      if (req.path.startsWith('/api')) return next();
      // Static fayl topilsa — jo'natish
      const filePath = path.join(frontendPath, req.path);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
      }
      // Barcha boshqa so'rovlar — SPA index.html
      return res.sendFile(path.join(frontendPath, 'index.html'));
    });
    app.get(Logger).log(`🌐 Frontend static: ${frontendPath}`);
  }

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  app.get(Logger).log(`✅ Backend http://localhost:${port} portida ishga tushdi`);
}

void bootstrap();
