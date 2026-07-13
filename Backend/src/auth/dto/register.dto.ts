import { Gender, ProfileCreatedBy } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 20)
  password!: string;

  @IsString()
  @Matches(/^\+\d{1,4}$/)
  countryCode!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @IsEnum(ProfileCreatedBy)
  profileCreatedBy!: ProfileCreatedBy;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
