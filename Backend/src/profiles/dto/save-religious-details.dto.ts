import { Dosh } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SaveReligiousDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  religion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  caste?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subcaste?: string;

  @IsOptional()
  @IsBoolean()
  openToAnySubcaste?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  gothra?: string;

  @IsOptional()
  @IsEnum(Dosh)
  dosh?: Dosh;
}
