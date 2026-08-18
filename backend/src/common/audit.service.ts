import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  admin: string;
  action: string;
  entity: string;
  entityId: string | number;
  oldValue?: string | null;
  newValue?: string | null;
  ip?: string | null;
}

/**
 * Admin harakatlari auditi.
 * Izoh: parol va maxfiy ma'lumotlar HECH QACHON log qilinmaydi.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          admin: entry.admin,
          action: entry.action,
          entity: entry.entity,
          entityId: String(entry.entityId),
          oldValue: entry.oldValue ?? null,
          newValue: entry.newValue ?? null,
          ip: entry.ip ?? null,
        },
      });
    } catch (err) {
      // Audit xatosi asosiy biznes oqimini buzmasligi kerak
      this.logger.error(
        `Audit log yozilmadi: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
