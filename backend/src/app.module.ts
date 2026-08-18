import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Controller, Get } from '@nestjs/common';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { TelegramModule } from './telegram/telegram.module';
import { AdminModule } from './admin/admin.module';
import { GatewayModule } from './gateway/gateway.module';
import { StatusModule } from './status/status.module';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Sog'liqni tekshirish: server + ma'lumotlar bazasi */
  @Get()
  async health() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      time: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Strukturaviy (JSON) loglash — pino
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          autoLogging: {
            ignore: (req) => (req.url ?? '').includes('/api/health'),
          },
          serializers: {
            req: (req) => ({
              method: req.method,
              url: req.url,
              remoteAddress: req.remoteAddress,
            }),
            res: (res) => ({ statusCode: res.statusCode }),
          },
        },
      }),
    }),

    // Global rate limit: har bir IP uchun 100 so'rov / daqiqa
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // Holat o'zgarishi hodisalari (Telegram xabarini tahrirlash uchun)
    EventEmitterModule.forRoot(),

    PrismaModule,
    AuthModule,
    MenuModule,
    OrdersModule,
    TelegramModule,
    AdminModule,
    GatewayModule,
    StatusModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
