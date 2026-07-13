import { IsJWT, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsJWT()
  refreshToken!: string;
}
