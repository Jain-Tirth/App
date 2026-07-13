import { Gender, ProfileCreatedBy } from '@prisma/client';
export declare class RegisterDto {
    fullName: string;
    email: string;
    password: string;
    countryCode: string;
    mobileNumber: string;
    profileCreatedBy: ProfileCreatedBy;
    gender?: Gender;
}
