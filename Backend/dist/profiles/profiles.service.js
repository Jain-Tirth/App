"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilesService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
let ProfilesService = class ProfilesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getMyProfile(currentUser) {
        const profile = await this.prisma.profile.findUnique({
            where: { userId: currentUser.sub },
            include: { user: true },
        });
        if (!profile) {
            return {
                profile: null,
                completion: {
                    percentage: 0,
                    completedSteps: 0,
                    totalSteps: 5,
                },
            };
        }
        return {
            profile: this.toProfileResponse(profile),
            completion: this.getCompletionSummary(profile),
        };
    }
    async savePersonalDetails(currentUser, dto) {
        const user = await this.getUserOrThrow(currentUser.sub);
        const profile = await this.prisma.$transaction(async (tx) => {
            const existingProfile = await tx.profile.findUnique({
                where: { userId: currentUser.sub },
            });
            await tx.user.update({
                where: { id: currentUser.sub },
                data: { gender: dto.gender },
            });
            if (!existingProfile) {
                const profileUid = await this.generateProfileUid(tx);
                return tx.profile.create({
                    data: {
                        userId: currentUser.sub,
                        profileUid,
                        dateOfBirth: new Date(dto.dateOfBirth),
                        heightCm: dto.heightCm,
                        physicalStatus: dto.physicalStatus,
                        maritalStatus: dto.maritalStatus,
                        spokenLanguages: [],
                        profileComplete: 0,
                    },
                    include: { user: true },
                });
            }
            return tx.profile.update({
                where: { userId: currentUser.sub },
                data: {
                    dateOfBirth: new Date(dto.dateOfBirth),
                    heightCm: dto.heightCm,
                    physicalStatus: dto.physicalStatus,
                    maritalStatus: dto.maritalStatus,
                },
                include: { user: true },
            });
        });
        return this.finalizeProfileUpdate(profile);
    }
    async saveReligiousDetails(currentUser, dto) {
        await this.ensureProfileExists(currentUser.sub);
        const profile = await this.prisma.profile.update({
            where: { userId: currentUser.sub },
            data: {
                religion: dto.religion,
                caste: dto.caste,
                subcaste: dto.subcaste,
                openToAnySubcaste: dto.openToAnySubcaste,
                gothra: dto.gothra,
                dosh: dto.dosh,
            },
            include: { user: true },
        });
        return this.finalizeProfileUpdate(profile);
    }
    async saveLocationDetails(currentUser, dto) {
        await this.ensureProfileExists(currentUser.sub);
        const profile = await this.prisma.profile.update({
            where: { userId: currentUser.sub },
            data: {
                country: dto.country,
                state: dto.state,
                city: dto.city,
            },
            include: { user: true },
        });
        return this.finalizeProfileUpdate(profile);
    }
    async saveProfessionalDetails(currentUser, dto) {
        await this.ensureProfileExists(currentUser.sub);
        const profile = await this.prisma.profile.update({
            where: { userId: currentUser.sub },
            data: {
                education: dto.education,
                employmentType: dto.employmentType,
                occupation: dto.occupation,
                incomeCurrency: dto.incomeCurrency,
                annualIncomeRange: dto.annualIncomeRange,
            },
            include: { user: true },
        });
        return this.finalizeProfileUpdate(profile);
    }
    async saveAdditionalDetails(currentUser, dto) {
        await this.ensureProfileExists(currentUser.sub);
        const profile = await this.prisma.profile.update({
            where: { userId: currentUser.sub },
            data: {
                familyStatus: dto.familyStatus,
                aboutMyself: dto.aboutMyself,
                lookingFor: dto.lookingFor,
            },
            include: { user: true },
        });
        return this.finalizeProfileUpdate(profile);
    }
    async finalizeProfileUpdate(profile) {
        const percentage = this.calculateProfileCompletion(profile);
        const updatedProfile = await this.prisma.profile.update({
            where: { userId: profile.userId },
            data: { profileComplete: percentage },
            include: { user: true },
        });
        return {
            profile: this.toProfileResponse(updatedProfile),
            completion: this.getCompletionSummary(updatedProfile),
        };
    }
    async getUserOrThrow(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found.');
        }
        if (!user.mobileVerified) {
            throw new common_1.BadRequestException('Verify OTP before creating a profile.');
        }
        return user;
    }
    async ensureProfileExists(userId) {
        const profile = await this.prisma.profile.findUnique({
            where: { userId },
        });
        if (!profile) {
            throw new common_1.BadRequestException('Complete personal details before saving later steps.');
        }
    }
    async generateProfileUid(tx) {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const profileUid = `DHB${(0, crypto_1.randomInt)(1000000, 10000000)}`;
            const existingProfile = await tx.profile.findUnique({
                where: { profileUid },
            });
            if (!existingProfile) {
                return profileUid;
            }
        }
        throw new common_1.BadRequestException('Unable to generate a unique profile ID.');
    }
    calculateProfileCompletion(profile) {
        const stepChecks = [
            Boolean(profile.user.gender),
            Boolean(profile.dateOfBirth),
            profile.heightCm !== null,
            profile.physicalStatus !== null,
            profile.maritalStatus !== null,
            Boolean(profile.religion),
            Boolean(profile.caste),
            Boolean(profile.subcaste),
            Boolean(profile.country),
            Boolean(profile.state),
            Boolean(profile.city),
            Boolean(profile.education),
            profile.employmentType !== null,
            Boolean(profile.occupation),
            Boolean(profile.annualIncomeRange),
            profile.familyStatus !== null,
            Boolean(profile.aboutMyself),
        ];
        const completedFieldCount = stepChecks.filter(Boolean).length;
        return Math.round((completedFieldCount / stepChecks.length) * 100);
    }
    getCompletionSummary(profile) {
        const completedSteps = [
            Boolean(profile.user.gender) &&
                Boolean(profile.dateOfBirth) &&
                profile.heightCm !== null &&
                profile.physicalStatus !== null &&
                profile.maritalStatus !== null,
            Boolean(profile.religion) &&
                Boolean(profile.caste) &&
                Boolean(profile.subcaste),
            Boolean(profile.country) && Boolean(profile.state) && Boolean(profile.city),
            Boolean(profile.education) &&
                profile.employmentType !== null &&
                Boolean(profile.occupation) &&
                Boolean(profile.annualIncomeRange),
            profile.familyStatus !== null && Boolean(profile.aboutMyself),
        ].filter(Boolean).length;
        return {
            percentage: profile.profileComplete,
            completedSteps,
            totalSteps: 5,
        };
    }
    toProfileResponse(profile) {
        return {
            id: profile.id,
            userId: profile.userId,
            profileUid: profile.profileUid,
            profileComplete: profile.profileComplete,
            user: {
                id: profile.user.id,
                name: profile.user.name,
                email: profile.user.email,
                mobile: profile.user.mobile,
                gender: profile.user.gender,
                profileCreatedBy: profile.user.profileCreatedBy,
                accountStatus: profile.user.accountStatus,
            },
            personalDetails: {
                dateOfBirth: profile.dateOfBirth,
                heightCm: profile.heightCm,
                physicalStatus: profile.physicalStatus,
                maritalStatus: profile.maritalStatus,
            },
            religiousDetails: {
                religion: profile.religion,
                caste: profile.caste,
                subcaste: profile.subcaste,
                openToAnySubcaste: profile.openToAnySubcaste,
                gothra: profile.gothra,
                dosh: profile.dosh,
            },
            locationDetails: {
                country: profile.country,
                state: profile.state,
                city: profile.city,
            },
            professionalDetails: {
                education: profile.education,
                employmentType: profile.employmentType,
                occupation: profile.occupation,
                incomeCurrency: profile.incomeCurrency,
                annualIncomeRange: profile.annualIncomeRange,
            },
            additionalDetails: {
                familyStatus: profile.familyStatus,
                aboutMyself: profile.aboutMyself,
                lookingFor: profile.lookingFor,
            },
        };
    }
};
exports.ProfilesService = ProfilesService;
exports.ProfilesService = ProfilesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProfilesService);
//# sourceMappingURL=profiles.service.js.map