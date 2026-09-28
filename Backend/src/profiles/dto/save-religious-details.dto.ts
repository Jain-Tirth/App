import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export enum Dosh {
  no = 'no',
  yes = 'yes',
  dontKnow = 'dontKnow',
}

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

  @IsOptional()
  @IsEnum(Dosh)
  manglik?: Dosh;
}
