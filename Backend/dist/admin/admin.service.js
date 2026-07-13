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
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async listPendingProfiles() {
        const profiles = await this.prisma.profile.findMany({
            where: {
                user: {
                    accountStatus: client_1.AccountStatus.pending,
                    role: 'user',
                },
            },
            include: { user: true },
            orderBy: { createdAt: 'asc' },
        });
        return {
            total: profiles.length,
            profiles: profiles.map((profile) => this.toPendingProfileListItem(profile)),
        };
    }
    async getProfileForReview(userId) {
        const profile = await this.getProfileByUserId(userId);
        return {
            profile: this.toReviewProfileResponse(profile),
        };
    }
    async approveProfile(userId, adminUser) {
        const profile = await this.getProfileByUserId(userId);
        if (profile.user.accountStatus === client_1.AccountStatus.active) {
            throw new common_1.BadRequestException('This profile is already approved.');
        }
        if (profile.user.accountStatus === client_1.AccountStatus.blocked) {
            throw new common_1.BadRequestException('Blocked accounts cannot be approved.');
        }
        const updatedProfile = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    accountStatus: client_1.AccountStatus.active,
                    rejectionReason: null,
                },
            });
            await tx.adminAuditLog.create({
                data: {
                    adminId: adminUser.sub,
                    action: 'profile_approved',
                    targetId: userId,
                    notes: `Profile approved for ${updatedUser.email}`,
                },
            });
            return tx.profile.findUnique({
                where: { userId },
                include: { user: true },
            });
        });
        if (!updatedProfile) {
            throw new common_1.NotFoundException('Profile not found after approval.');
        }
        return {
            message: 'Profile approved successfully.',
            profile: this.toReviewProfileResponse(updatedProfile),
        };
    }
    async rejectProfile(userId, dto, adminUser) {
        const profile = await this.getProfileByUserId(userId);
        if (profile.user.accountStatus === client_1.AccountStatus.blocked) {
            throw new common_1.BadRequestException('Blocked accounts cannot be rejected.');
        }
        const updatedProfile = await this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: {
                    accountStatus: client_1.AccountStatus.rejected,
                    rejectionReason: dto.reason.trim(),
                },
            });
            await tx.adminAuditLog.create({
                data: {
                    adminId: adminUser.sub,
                    action: 'profile_rejected',
                    targetId: userId,
                    notes: dto.reason.trim(),
                },
            });
            return tx.profile.findUnique({
                where: { userId },
                include: { user: true },
            });
        });
        if (!updatedProfile) {
            throw new common_1.NotFoundException('Profile not found after rejection.');
        }
        return {
            message: 'Profile rejected successfully.',
            profile: this.toReviewProfileResponse(updatedProfile),
        };
    }
    async getProfileByUserId(userId) {
        const profile = await this.prisma.profile.findUnique({
            where: { userId },
            include: { user: true },
        });
        if (!profile) {
            throw new common_1.NotFoundException('Profile not found.');
        }
        return profile;
    }
    toPendingProfileListItem(profile) {
        return {
            userId: profile.userId,
            profileId: profile.id,
            profileUid: profile.profileUid,
            name: profile.user.name,
            email: profile.user.email,
            mobile: profile.user.mobile,
            gender: profile.user.gender,
            profileCreatedBy: profile.user.profileCreatedBy,
            accountStatus: profile.user.accountStatus,
            profileComplete: profile.profileComplete,
            createdAt: profile.createdAt,
        };
    }
    toReviewProfileResponse(profile) {
        return {
            id: profile.id,
            userId: profile.userId,
            profileUid: profile.profileUid,
            profileComplete: profile.profileComplete,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
            user: this.toReviewUserResponse(profile.user),
            personalDetails: {
                dateOfBirth: profile.dateOfBirth,
                heightCm: profile.heightCm,
                weightKg: profile.weightKg,
                bodyType: profile.bodyType,
                physicalStatus: profile.physicalStatus,
                maritalStatus: profile.maritalStatus,
                spokenLanguages: profile.spokenLanguages,
                eatingHabits: profile.eatingHabits,
                residentStatus: profile.residentStatus,
            },
            religiousDetails: {
                religion: profile.religion,
                caste: profile.caste,
                subcaste: profile.subcaste,
                openToAnySubcaste: profile.openToAnySubcaste,
                gothra: profile.gothra,
                dosh: profile.dosh,
                manglik: profile.manglik,
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
            verificationFlags: {
                photoVerified: profile.photoVerified,
                idVerified: profile.idVerified,
            },
        };
    }
    toReviewUserResponse(user) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            mobile: user.mobile,
            role: user.role,
            gender: user.gender,
            accountStatus: user.accountStatus,
            rejectionReason: user.rejectionReason,
            profileCreatedBy: user.profileCreatedBy,
            mobileVerified: user.mobileVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map