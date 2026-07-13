import { Gender, MaritalStatus, PhysicalStatus } from '@prisma/client';
export declare class SavePersonalDetailsDto {
    gender: Gender;
    dateOfBirth: string;
    heightCm?: number;
    physicalStatus?: PhysicalStatus;
    maritalStatus?: MaritalStatus;
}
