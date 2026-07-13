import { IsEmail, IsString, Length } from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 20)
  password!: string;
}
