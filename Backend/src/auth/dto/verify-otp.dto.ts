import { IsString, Matches, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+\d{1,4}$/)
  countryCode!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  mobileNumber!: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  otpCode!: string;
}
