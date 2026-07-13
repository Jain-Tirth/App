import { EmploymentType } from '@prisma/client';
export declare class SaveProfessionalDetailsDto {
    education?: string;
    employmentType?: EmploymentType;
    occupation?: string;
    incomeCurrency?: string;
    annualIncomeRange?: string;
}
