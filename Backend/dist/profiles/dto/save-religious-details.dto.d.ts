import { Dosh } from '@prisma/client';
export declare class SaveReligiousDetailsDto {
    religion?: string;
    caste?: string;
    subcaste?: string;
    openToAnySubcaste?: boolean;
    gothra?: string;
    dosh?: Dosh;
}
