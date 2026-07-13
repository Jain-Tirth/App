import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Profile, User } from '@prisma/client';
import { randomInt } from 'crypto';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { SaveAdditionalDetailsDto } from './dto/save-additional-details.dto';
import { SaveLocationDetailsDto } from './dto/save-location-details.dto';
import { SavePersonalDetailsDto } from './dto/save-personal-details.dto';
import { SaveProfessionalDetailsDto } from './dto/save-professional-details.dto';
import { SaveReligiousDetailsDto } from './dto/save-religious-details.dto';

type ProfileWithUser = Profile & { user: User };

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyProfile(currentUser: AuthenticatedUser) {
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

  async savePersonalDetails(
    currentUser: AuthenticatedUser,
    dto: SavePersonalDetailsDto,
  ) {
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

  async saveReligiousDetails(
    currentUser: AuthenticatedUser,
    dto: SaveReligiousDetailsDto,
  ) {
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

  async saveLocationDetails(
    currentUser: AuthenticatedUser,
    dto: SaveLocationDetailsDto,
  ) {
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

  async saveProfessionalDetails(
    currentUser: AuthenticatedUser,
    dto: SaveProfessionalDetailsDto,
  ) {
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

  async saveAdditionalDetails(
    currentUser: AuthenticatedUser,
    dto: SaveAdditionalDetailsDto,
  ) {
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

  private async finalizeProfileUpdate(profile: ProfileWithUser) {
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

  private async getUserOrThrow(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (!user.mobileVerified) {
      throw new BadRequestException('Verify OTP before creating a profile.');
    }

    return user;
  }

  private async ensureProfileExists(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new BadRequestException(
        'Complete personal details before saving later steps.',
      );
    }
  }

  private async generateProfileUid(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const profileUid = `DHB${randomInt(1000000, 10000000)}`;
      const existingProfile = await tx.profile.findUnique({
        where: { profileUid },
      });

      if (!existingProfile) {
        return profileUid;
      }
    }

    throw new BadRequestException('Unable to generate a unique profile ID.');
  }

  private calculateProfileCompletion(profile: ProfileWithUser) {
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

  private getCompletionSummary(profile: ProfileWithUser) {
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

  private toProfileResponse(profile: ProfileWithUser) {
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
}
