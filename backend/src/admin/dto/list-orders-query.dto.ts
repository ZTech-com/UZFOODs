import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OrderStatus } from '../../common/order-status';

export type OrderSort =
  | 'newest'
  | 'oldest'
  | 'highest'
  | 'lowest'
  | 'soonest'
  | 'latest';

export type OrderTimeFilter = 'upcoming' | 'overdue' | 'completed';

const SORTS: OrderSort[] = ['newest', 'oldest', 'highest', 'lowest', 'soonest', 'latest'];
const TIMES: OrderTimeFilter[] = ['upcoming', 'overdue', 'completed'];

export class ListOrdersQueryDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsIn(SORTS)
  sort?: OrderSort;

  @IsOptional()
  @IsIn(TIMES)
  time?: OrderTimeFilter;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
