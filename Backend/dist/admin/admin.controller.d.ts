import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminService } from './admin.service';
import { RejectProfileDto } from './dto/reject-profile.dto';
export declare class AdminController {
    private readonly adminService;
    constructor(adminService: AdminService);
    listPendingProfiles(): Promise<{
        total: number;
        profiles: {
            userId: string;
            profileId: string;
            profileUid: string | null;
            name: string;
            email: string;
            mobile: string;
            gender: import(".prisma/client").$Enums.Gender | null;
            profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
            accountStatus: import(".prisma/client").$Enums.AccountStatus;
            profileComplete: number;
            createdAt: Date;
        }[];
    }>;
    getProfileForReview(userId: string): Promise<{
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            createdAt: Date;
            updatedAt: Date;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                role: import(".prisma/client").$Enums.Role;
                gender: import(".prisma/client").$Enums.Gender | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
                rejectionReason: string | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                mobileVerified: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                weightKg: number | null;
                bodyType: import(".prisma/client").$Enums.BodyType | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
                spokenLanguages: string[];
                eatingHabits: import(".prisma/client").$Enums.EatingHabits | null;
                residentStatus: import(".prisma/client").$Enums.ResidentStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
                manglik: import(".prisma/client").$Enums.Dosh | null;
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
            verificationFlags: {
                photoVerified: boolean;
                idVerified: boolean;
            };
        };
    }>;
    approveProfile(userId: string, adminUser: AuthenticatedUser): Promise<{
        message: string;
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            createdAt: Date;
            updatedAt: Date;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                role: import(".prisma/client").$Enums.Role;
                gender: import(".prisma/client").$Enums.Gender | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
                rejectionReason: string | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                mobileVerified: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                weightKg: number | null;
                bodyType: import(".prisma/client").$Enums.BodyType | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
                spokenLanguages: string[];
                eatingHabits: import(".prisma/client").$Enums.EatingHabits | null;
                residentStatus: import(".prisma/client").$Enums.ResidentStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
                manglik: import(".prisma/client").$Enums.Dosh | null;
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
            verificationFlags: {
                photoVerified: boolean;
                idVerified: boolean;
            };
        };
    }>;
    rejectProfile(userId: string, dto: RejectProfileDto, adminUser: AuthenticatedUser): Promise<{
        message: string;
        profile: {
            id: string;
            userId: string;
            profileUid: string | null;
            profileComplete: number;
            createdAt: Date;
            updatedAt: Date;
            user: {
                id: string;
                name: string;
                email: string;
                mobile: string;
                role: import(".prisma/client").$Enums.Role;
                gender: import(".prisma/client").$Enums.Gender | null;
                accountStatus: import(".prisma/client").$Enums.AccountStatus;
                rejectionReason: string | null;
                profileCreatedBy: import(".prisma/client").$Enums.ProfileCreatedBy | null;
                mobileVerified: boolean;
                createdAt: Date;
                updatedAt: Date;
            };
            personalDetails: {
                dateOfBirth: Date;
                heightCm: number | null;
                weightKg: number | null;
                bodyType: import(".prisma/client").$Enums.BodyType | null;
                physicalStatus: import(".prisma/client").$Enums.PhysicalStatus | null;
                maritalStatus: import(".prisma/client").$Enums.MaritalStatus | null;
                spokenLanguages: string[];
                eatingHabits: import(".prisma/client").$Enums.EatingHabits | null;
                residentStatus: import(".prisma/client").$Enums.ResidentStatus | null;
            };
            religiousDetails: {
                religion: string | null;
                caste: string | null;
                subcaste: string | null;
                openToAnySubcaste: boolean;
                gothra: string | null;
                dosh: import(".prisma/client").$Enums.Dosh | null;
                manglik: import(".prisma/client").$Enums.Dosh | null;
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
            verificationFlags: {
                photoVerified: boolean;
                idVerified: boolean;
            };
        };
    }>;
}
