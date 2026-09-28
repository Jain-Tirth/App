import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveAdditionalDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  familyStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  aboutMyself?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  lookingFor?: string;
}
