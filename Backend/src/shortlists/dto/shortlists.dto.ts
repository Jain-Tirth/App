import { Transform, Type } from 'class-transformer';
import {
  IsEmpty,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { MAX_SHORTLIST_PAGE_SIZE, SHORTLIST_NAME_MAX } from '../shortlist.types';

/** Body of create and rename. Only `name` is accepted (SEC-13). */
export class ShortlistNameDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(SHORTLIST_NAME_MAX)
  name!: string;
}

/** Body of add and remove: none; any field is rejected. */
export class EmptyBodyDto {
  @IsOptional()
  @IsEmpty()
  _none?: never;
}

export class ListShortlistProfilesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SHORTLIST_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  cursor?: string;
}
