import { FamilyStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveAdditionalDetailsDto {
  @IsOptional()
  @IsEnum(FamilyStatus)
  familyStatus?: FamilyStatus;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  aboutMyself?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  lookingFor?: string;
}
