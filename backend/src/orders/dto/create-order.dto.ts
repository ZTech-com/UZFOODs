import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CustomerDto {
  @IsString()
  @MinLength(2, { message: 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak' })
  @MaxLength(100)
  name!: string;

  @Matches(/^\+?[\d\s-]{8,20}$/, { message: 'Telefon raqam noto\'g\'ri formatda' })
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  telegramUsername?: string;
}

export class OrderItemDto {
  @IsInt()
  @Min(1)
  menuItemId!: number;

  @IsInt()
  @Min(1)
  @Max(50, { message: 'Bitta taomdan ko\'pi bilan 50 porsiya buyurtma qilsa bo\'ladi' })
  quantity!: number;
}

export class CreateOrderDto {
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'requiredTime HH:MM formatida bo\'lishi kerak (masalan 13:30)',
  })
  requiredTime!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Kamida bitta taom tanlang' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  /** Mijoz izohi (ixtiyoriy) — masalan "Achchiq bo'lmasin" */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
