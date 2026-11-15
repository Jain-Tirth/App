import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SEARCH_SORTS } from '../discovery.types';

export const MAX_PAGE_SIZE = 50;

const MARITAL_STATUSES = [
  'neverMarried',
  'widower',
  'awaitingDivorce',
  'divorced',
] as const;

const DIETS = ['vegetarian', 'nonVegetarian', 'eggetarian'] as const;

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Every accepted query parameter. The global validation pipe rejects anything
 * else with 400, so `ageMin`, `profileUid` and the like cannot reach SQL.
 */
export class SearchQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @IsIn(SEARCH_SORTS)
  sort?: (typeof SEARCH_SORTS)[number];

  @IsOptional()
  @IsIn(MARITAL_STATUSES)
  maritalStatus?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  religion?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  community?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsIn(DIETS)
  diet?: string;
}
