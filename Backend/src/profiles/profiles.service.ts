import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ApiException } from '../common/api-error';
import { env } from '../config/env';
import { evaluateAgeGate } from './age-gate';
import { DatabaseService } from '../database/database.service';
import { SaveAdditionalDetailsDto } from './dto/save-additional-details.dto';
import { SaveLocationDetailsDto } from './dto/save-location-details.dto';
import { SavePersonalDetailsDto } from './dto/save-personal-details.dto';
import { SaveProfessionalDetailsDto } from './dto/save-professional-details.dto';
import { SaveReligiousDetailsDto } from './dto/save-religious-details.dto';

interface RawProfilePayload {
  user: {
    id: string;
    name: string;
    email: string;
    mobile: string;
    gender: string | null;
    profileCreatedBy: string | null;
    accountStatus: string;
    membershipType: string;
  };
  profile: {
    id: string;
    userId: string;
    profileUid: string | null;
    profileComplete: number;
    photoVerified: boolean;
    idVerified: boolean;
    personalDetails: Record<string, any>;
    religiousDetails: Record<string, any>;
    locationDetails: Record<string, any>;
    professionalDetails: Record<string, any>;
    additionalDetails: Record<string, any>;
  } | null;
}

@Injectable()
export class ProfilesService {
  constructor(private readonly db: DatabaseService) {}

  async getMyProfile(currentUser: AuthenticatedUser) {
    const rawResult = await this.db.callFunctionSingle<{
      fn_get_profile_by_user_id: RawProfilePayload;
    }>('fn_get_profile_by_user_id', [currentUser.sub]);

    const payload = rawResult?.fn_get_profile_by_user_id;

    if (!payload || !payload.profile) {
      return {
        profile: null,
        completion: {
          percentage: 0,
          completedSteps: 0,
          totalSteps: 5,
        },
      };
    }

    const { user, profile } = payload;
    const completedSteps = this.countCompletedSteps(profile);

    return {
      profile: {
        ...profile,
        user,
      },
      completion: {
        percentage: profile.profileComplete ?? 0,
        completedSteps,
        totalSteps: 5,
      },
    };
  }

  async getActiveMatches(currentUser: AuthenticatedUser) {
    const rawResult = await this.db.callFunctionSingle<{
      fn_get_active_matches: any[];
    }>('fn_get_active_matches', [currentUser.sub]);

    const matches = rawResult?.fn_get_active_matches ?? [];

    return {
      total: matches.length,
      matches,
    };
  }

  async savePersonalDetails(
    currentUser: AuthenticatedUser,
    dto: SavePersonalDetailsDto,
  ) {
    this.assertAgeAllowed(dto);
    await this.assertUserVerified(currentUser.sub);

    if (dto.gender) {
      await this.db.query('UPDATE "Users" SET "gender" = $1 WHERE "id" = $2', [
        dto.gender,
        currentUser.sub,
      ]);
    }

    await this.db.callFunction('fn_save_step_1_personal', [
      currentUser.sub,
      dto.dateOfBirth,
      dto.heightCm ?? null,
      dto.weightKg ?? null,
      dto.physicalStatus ?? null,
      dto.maritalStatus ?? null,
      dto.spokenLanguages ?? [],
      dto.eatingHabits ?? null,
      dto.residentStatus ?? null,
    ]);

    return this.getMyProfile(currentUser);
  }

  async saveReligiousDetails(
    currentUser: AuthenticatedUser,
    dto: SaveReligiousDetailsDto,
  ) {
    await this.assertProfileExists(currentUser.sub);

    await this.db.callFunction('fn_save_step_2_religious', [
      currentUser.sub,
      dto.religion ?? null,
      dto.caste ?? null,
      dto.subcaste ?? null,
      dto.openToAnySubcaste ?? false,
      dto.gothra ?? null,
      dto.dosh ?? null,
      dto.manglik ?? null,
    ]);

    return this.getMyProfile(currentUser);
  }

  async saveLocationDetails(
    currentUser: AuthenticatedUser,
    dto: SaveLocationDetailsDto,
  ) {
    await this.assertProfileExists(currentUser.sub);

    await this.db.callFunction('fn_save_step_3_location', [
      currentUser.sub,
      dto.country ?? null,
      dto.state ?? null,
      dto.city ?? null,
    ]);

    return this.getMyProfile(currentUser);
  }

  async saveProfessionalDetails(
    currentUser: AuthenticatedUser,
    dto: SaveProfessionalDetailsDto,
  ) {
    await this.assertProfileExists(currentUser.sub);

    await this.db.callFunction('fn_save_step_4_professional', [
      currentUser.sub,
      dto.education ?? null,
      dto.employmentType ?? null,
      dto.occupation ?? null,
      dto.incomeCurrency ?? 'INR',
      dto.annualIncomeRange ?? null,
    ]);

    return this.getMyProfile(currentUser);
  }

  async saveAdditionalDetails(
    currentUser: AuthenticatedUser,
    dto: SaveAdditionalDetailsDto,
  ) {
    await this.assertProfileExists(currentUser.sub);

    await this.db.callFunction('fn_save_step_5_family_bio', [
      currentUser.sub,
      dto.familyStatus ?? null,
      dto.aboutMyself ?? null,
      dto.lookingFor ?? null,
    ]);

    return this.getMyProfile(currentUser);
  }

  private assertAgeAllowed(dto: SavePersonalDetailsDto): void {
    const result = evaluateAgeGate(
      dto.gender,
      dto.dateOfBirth,
      new Date(),
      env.ageMinimums,
    );

    if (result.ok) {
      return;
    }

    if (result.reason === 'AGE_BELOW_MINIMUM') {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'AGE_BELOW_MINIMUM',
        `Members must be at least ${result.minimumAge} years old.`,
        { minimumAge: result.minimumAge },
      );
    }

    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      'INVALID_DATE_OF_BIRTH',
      'Date of birth must be a real date that is not in the future.',
      { field: 'dateOfBirth' },
    );
  }

  private async assertUserVerified(userId: string) {
    const res = await this.db.query(
      'SELECT "id", "mobileVerified" FROM "Users" WHERE "id" = $1',
      [userId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException('User not found.');
    }

    if (!res.rows[0].mobileVerified) {
      throw new BadRequestException('Verify OTP before creating a profile.');
    }
  }

  private async assertProfileExists(userId: string) {
    const res = await this.db.query(
      'SELECT "id" FROM "Profiles" WHERE "userId" = $1',
      [userId],
    );

    if (res.rowCount === 0) {
      throw new BadRequestException(
        'Complete personal details before saving later steps.',
      );
    }
  }

  private countCompletedSteps(profile: {
    personalDetails?: Record<string, any>;
    religiousDetails?: Record<string, any>;
    locationDetails?: Record<string, any>;
    professionalDetails?: Record<string, any>;
    additionalDetails?: Record<string, any>;
  }): number {
    let count = 0;
    if (profile.personalDetails && Object.keys(profile.personalDetails).length > 0) count++;
    if (profile.religiousDetails && Object.keys(profile.religiousDetails).length > 0) count++;
    if (profile.locationDetails && Object.keys(profile.locationDetails).length > 0) count++;
    if (profile.professionalDetails && Object.keys(profile.professionalDetails).length > 0) count++;
    if (profile.additionalDetails && Object.keys(profile.additionalDetails).length > 0) count++;
    return count;
  }
}
