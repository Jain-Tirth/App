import { ConfigService } from '@nestjs/config';
import { AdminTokenPayload } from './admin-auth.types';
declare const AdminJwtStrategy_base: new (...args: any) => any;
export declare class AdminJwtStrategy extends AdminJwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: AdminTokenPayload): AdminTokenPayload;
}
export {};
