import { IsString, Matches } from 'class-validator';

export class ResendOtpDto {
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  countryCode!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;
}
