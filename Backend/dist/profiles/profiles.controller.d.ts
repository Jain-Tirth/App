import type { AuthenticatedUser } from '../auth/auth.types';
import { SaveAdditionalDetailsDto } from './dto/save-additional-details.dto';
import { SaveLocationDetailsDto } from './dto/save-location-details.dto';
import { SavePersonalDetailsDto } from './dto/save-personal-details.dto';
import { SaveProfessionalDetailsDto } from './dto/save-professional-details.dto';
import { SaveReligiousDetailsDto } from './dto/save-religious-details.dto';
import { ProfilesService } from './profiles.service';
export declare class ProfilesController {
    private readonly profilesService;
    constructor(profilesService: ProfilesService);
    getMyProfile(user: AuthenticatedUser): Promise<{
        profile: null;
        completion: {
            percentage: number;
            completedSteps: number;
            totalSteps: number;
        };
    } | {
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                gender: import(".prisma/client").$Enums.Gender | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
            };
            locationDetails: {
                country: string | null;
                state: string | null;
                city: string | null;
            };
            professionalDetails: {
                education: string | null;
                employmentType: import(".prisma/client").$Enums.EmploymentType | null;
                occupation: string | null;
                incomeCurrency: string | null;
                annualIncomeRange: string | null;
            };
            additionalDetails: {
                familyStatus: import(".prisma/client").$Enums.FamilyStatus | null;
                aboutMyself: string | null;
                lookingFor: string | null;
            };
        };
        completion: {
            percentage: number;
            completedSteps: number;
            totalSteps: number;
        };
    }>;
    savePersonalDetails(user: AuthenticatedUser, dto: SavePersonalDetailsDto): Promise<{
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                gender: import(".prisma/client").$Enums.Gender | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
            };
            locationDetails: {
                country: string | null;
                state: string | null;
                city: string | null;
            };
            professionalDetails: {
                education: string | null;
                employmentType: import(".prisma/client").$Enums.EmploymentType | null;
                occupation: string | null;
                incomeCurrency: string | null;
                annualIncomeRange: string | null;
            };
            additionalDetails: {
                familyStatus: import(".prisma/client").$Enums.FamilyStatus | null;
                aboutMyself: string | null;
                lookingFor: string | null;
            };
        };
        completion: {
            percentage: number;
            completedSteps: number;
            totalSteps: number;
        };
    }>;
    saveReligiousDetails(user: AuthenticatedUser, dto: SaveReligiousDetailsDto): Promise<{
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                gender: import(".prisma/client").$Enums.Gender | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
            };
            locationDetails: {
                country: string | null;
                state: string | null;
                city: string | null;
            };
            professionalDetails: {
                education: string | null;
                employmentType: import(".prisma/client").$Enums.EmploymentType | null;
                occupation: string | null;
                incomeCurrency: string | null;
                annualIncomeRange: string | null;
            };
            additionalDetails: {
                familyStatus: import(".prisma/client").$Enums.FamilyStatus | null;
                aboutMyself: string | null;
                lookingFor: string | null;
            };
        };
        completion: {
            percentage: number;
            completedSteps: number;
            totalSteps: number;
        };
    }>;
    saveLocationDetails(user: AuthenticatedUser, dto: SaveLocationDetailsDto): Promise<{
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                gender: import(".prisma/client").$Enums.Gender | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
            };
            locationDetails: {
                country: string | null;
                state: string | null;
                city: string | null;
            };
            professionalDetails: {
                education: string | null;
                employmentType: import(".prisma/client").$Enums.EmploymentType | null;
                occupation: string | null;
                incomeCurrency: string | null;
                annualIncomeRange: string | null;
            };
            additionalDetails: {
                familyStatus: import(".prisma/client").$Enums.FamilyStatus | null;
                aboutMyself: string | null;
                lookingFor: string | null;
            };
        };
        completion: {
            percentage: number;
            completedSteps: number;
            totalSteps: number;
        };
    }>;
    saveProfessionalDetails(user: AuthenticatedUser, dto: SaveProfessionalDetailsDto): Promise<{
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                gender: import(".prisma/client").$Enums.Gender | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
            };
            locationDetails: {
                country: string | null;
                state: string | null;
                city: string | null;
            };
            professionalDetails: {
                education: string | null;
                employmentType: import(".prisma/client").$Enums.EmploymentType | null;
                occupation: string | null;
                incomeCurrency: string | null;
                annualIncomeRange: string | null;
            };
            additionalDetails: {
                familyStatus: import(".prisma/client").$Enums.FamilyStatus | null;
                aboutMyself: string | null;
                lookingFor: string | null;
            };
        };
        completion: {
            percentage: number;
            completedSteps: number;
            totalSteps: number;
        };
    }>;
    saveAdditionalDetails(user: AuthenticatedUser, dto: SaveAdditionalDetailsDto): Promise<{
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                gender: import(".prisma/client").$Enums.Gender | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
            };
            locationDetails: {
                country: string | null;
                state: string | null;
                city: string | null;
            };
            professionalDetails: {
                education: string | null;
                employmentType: import(".prisma/client").$Enums.EmploymentType | null;
                occupation: string | null;
                incomeCurrency: string | null;
                annualIncomeRange: string | null;
            };
            additionalDetails: {
                familyStatus: import(".prisma/client").$Enums.FamilyStatus | null;
                aboutMyself: string | null;
                lookingFor: string | null;
            };
        };
        completion: {
            percentage: number;
            completedSteps: number;
            totalSteps: number;
        };
    }>;
}
