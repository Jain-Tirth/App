import { ConfigService } from '@nestjs/config';
import { AuthTokenPayload } from '../auth.types';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: AuthTokenPayload): AuthTokenPayload;
}
export {};
