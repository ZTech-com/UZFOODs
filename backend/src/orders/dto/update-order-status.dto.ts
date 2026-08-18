import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '../../common/order-status';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  /** Bekor qilish sababi (CANCELLED bo'lganda) */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
