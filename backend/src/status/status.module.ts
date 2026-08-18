import { Module } from '@nestjs/common';
import { GatewayModule } from '../gateway/gateway.module';
import { OrderStatusService } from './order-status.service';
import { AuditService } from '../common/audit.service';

@Module({
  imports: [GatewayModule],
  providers: [OrderStatusService, AuditService],
  exports: [OrderStatusService, AuditService],
})
export class StatusModule {}
