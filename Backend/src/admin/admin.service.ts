import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RejectProfileDto } from './dto/reject-profile.dto';

type AdminProfileRecord = Prisma.ProfileGetPayload<{
  include: {
    user: true;
  };
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!admin || admin.role !== 'admin') {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
      },
      {
        secret: this.configService.getOrThrow<string>('ADMIN_JWT_SECRET'),
        expiresIn: this.configService.get<string>(
          'ADMIN_JWT_EXPIRES_IN',
          '12h',
        ) as StringValue,
      },
    );

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
    const [pendingProfiles, activeUsers, rejectedUsers, totalProfiles] =
      await Promise.all([
        this.prisma.profile.count({
          where: { user: { accountStatus: AccountStatus.pending, role: 'user' } },
        }),
        this.prisma.user.count({
          where: { accountStatus: AccountStatus.active, role: 'user' },
        }),
        this.prisma.user.count({
          where: { accountStatus: AccountStatus.rejected, role: 'user' },
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
          accountStatus: AccountStatus.pending,
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

  async getProfileForReview(userId: string) {
    const profile = await this.getProfileByUserId(userId);
    return {
      profile: this.toReviewProfileResponse(profile),
    };
  }

  async approveProfile(userId: string, adminUser: AuthenticatedUser) {
    const profile = await this.getProfileByUserId(userId);

    if (profile.user.accountStatus === AccountStatus.active) {
      throw new BadRequestException('This profile is already approved.');
    }

    if (profile.user.accountStatus === AccountStatus.blocked) {
      throw new BadRequestException('Blocked accounts cannot be approved.');
    }

    const updatedProfile = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.active,
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
      throw new NotFoundException('Profile not found after approval.');
    }

    return {
      message: 'Profile approved successfully.',
      profile: this.toReviewProfileResponse(updatedProfile),
    };
  }

  async rejectProfile(
    userId: string,
    dto: RejectProfileDto,
    adminUser: AuthenticatedUser,
  ) {
    const profile = await this.getProfileByUserId(userId);

    if (profile.user.accountStatus === AccountStatus.blocked) {
      throw new BadRequestException('Blocked accounts cannot be rejected.');
    }

    const updatedProfile = await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          accountStatus: AccountStatus.rejected,
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
      throw new NotFoundException('Profile not found after rejection.');
    }

    return {
      message: 'Profile rejected successfully.',
      profile: this.toReviewProfileResponse(updatedProfile),
    };
  }

  private async getProfileByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found.');
    }

    return profile;
  }

  private toPendingProfileListItem(profile: AdminProfileRecord) {
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

  private toReviewProfileResponse(profile: AdminProfileRecord) {
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

  private toReviewUserResponse(user: User) {
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
}
