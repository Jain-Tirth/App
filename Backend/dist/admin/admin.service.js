"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const jwt_1 = require("@nestjs/jwt");
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    prisma;
    jwtService;
    configService;
    constructor(prisma, jwtService, configService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async login(dto) {
        const email = dto.email.trim().toLowerCase();
        const admin = await this.prisma.user.findUnique({
            where: { email },
        });
        if (!admin || admin.role !== 'admin') {
            throw new common_1.UnauthorizedException('Invalid admin credentials.');
        }
        const passwordMatches = await bcrypt.compare(dto.password, admin.passwordHash);
        if (!passwordMatches) {
            throw new common_1.UnauthorizedException('Invalid admin credentials.');
        }
        const accessToken = await this.jwtService.signAsync({
            sub: admin.id,
            email: admin.email,
            role: admin.role,
        }, {
            secret: this.configService.getOrThrow('ADMIN_JWT_SECRET'),
            expiresIn: this.configService.get('ADMIN_JWT_EXPIRES_IN', '12h'),
        });
        return {
            message: 'Admin login successful.',
            admin: {
                id: admin.id,
                name: admin.name,
                email: admin.email,
                role: admin.role,
            },
            accessToken,
        };
    }
    async getDashboardStats() {
        const [pendingProfiles, activeUsers, rejectedUsers, totalProfiles] = await Promise.all([
            this.prisma.profile.count({
                where: { user: { accountStatus: client_1.AccountStatus.pending, role: 'user' } },
            }),
            this.prisma.user.count({
                where: { accountStatus: client_1.AccountStatus.active, role: 'user' },
            }),
            this.prisma.user.count({
                where: { accountStatus: client_1.AccountStatus.rejected, role: 'user' },
            }),
            this.prisma.profile.count({
                where: { user: { role: 'user' } },
            }),
        ]);
        return {
            pendingProfiles,
            approvedProfiles: activeUsers,
            rejectedProfiles: rejectedUsers,
            totalProfiles,
        };
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AdminService);
//# sourceMappingURL=admin.service.js.map