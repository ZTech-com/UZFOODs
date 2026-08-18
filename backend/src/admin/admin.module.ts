import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StatusModule } from '../status/status.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, StatusModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
