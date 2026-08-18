import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export type BulkAction = 'complete' | 'cancel' | 'delete';

export class BulkActionDto {
  @IsIn(['complete', 'cancel', 'delete'])
  action!: BulkAction;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];

  /** Bekor qilish sababi (cancel bo'lganda) */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
