import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum EmploymentType {
  private = 'private',
  business = 'business',
  defence = 'defence',
  governmentPsu = 'governmentPsu',
  notWorking = 'notWorking',
  selfEmployed = 'selfEmployed',
}

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
