import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export enum ProfileCreatedBy {
  myself = 'myself',
  son = 'son',
  daughter = 'daughter',
  brother = 'brother',
  sister = 'sister',
  friend = 'friend',
  relative = 'relative',
}

export enum Gender {
  male = 'male',
  female = 'female',
}

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
