import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum Gender {
  male = 'male',
  female = 'female',
}

export enum PhysicalStatus {
  normal = 'normal',
  physicallyChallenged = 'physicallyChallenged',
}

export enum MaritalStatus {
  neverMarried = 'neverMarried',
  widower = 'widower',
  awaitingDivorce = 'awaitingDivorce',
  divorced = 'divorced',
}

export enum EatingHabits {
  vegetarian = 'vegetarian',
  nonVegetarian = 'nonVegetarian',
  eggetarian = 'eggetarian',
}

export class SavePersonalDetailsDto {
  @IsEnum(Gender)
  gender!: Gender;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(120)
  @Max(240)
  heightCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(200)
  weightKg?: number;

  @IsOptional()
  @IsEnum(PhysicalStatus)
  physicalStatus?: PhysicalStatus;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  spokenLanguages?: string[];

  @IsOptional()
  @IsEnum(EatingHabits)
  eatingHabits?: EatingHabits;

  @IsOptional()
  @IsString()
  residentStatus?: string;
}
