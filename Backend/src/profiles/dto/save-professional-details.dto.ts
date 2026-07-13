import { EmploymentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveProfessionalDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  education?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  occupation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  incomeCurrency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  annualIncomeRange?: string;
}
