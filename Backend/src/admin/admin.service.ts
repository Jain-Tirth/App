import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RejectProfileDto } from './dto/reject-profile.dto';

interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}

interface DashboardStatsRow {
  totalProfiles: number;
  pendingApprovals: number;
  activeUsers: number;
  rejectedUsers: number;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: AdminLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const result = await this.db.query<AdminUserRow>(
      'SELECT "id", "name", "email", "passwordHash", "role" FROM "Users" WHERE "email" = $1 AND "role" = $2',
      [email, 'admin'],
    );

    const admin = result.rows[0];
    if (!admin) {
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
    const rawResult = await this.db.callFunctionSingle<{
      fn_admin_get_dashboard_stats: DashboardStatsRow;
    }>('fn_admin_get_dashboard_stats');

    const stats = rawResult?.fn_admin_get_dashboard_stats;

    return {
      pendingProfiles: Number(stats?.pendingApprovals ?? 0),
      approvedProfiles: Number(stats?.activeUsers ?? 0),
      rejectedProfiles: Number(stats?.rejectedUsers ?? 0),
      totalProfiles: Number(stats?.totalProfiles ?? 0),
    };
  }

  async listPendingProfiles() {
    const rawResult = await this.db.callFunctionSingle<{
      fn_admin_list_pending_profiles: any[];
    }>('fn_admin_list_pending_profiles');

    const list = rawResult?.fn_admin_list_pending_profiles ?? [];

    return {
      total: list.length,
      profiles: list,
    };
  }

  async getProfileForReview(userId: string) {
    const rawResult = await this.db.callFunctionSingle<{
      fn_get_profile_by_user_id: any;
    }>('fn_get_profile_by_user_id', [userId]);

    const payload = rawResult?.fn_get_profile_by_user_id;
    if (!payload || !payload.profile) {
      throw new NotFoundException('Profile not found.');
    }

    return {
      profile: {
        ...payload.profile,
        user: payload.user,
      },
    };
  }

  async approveProfile(userId: string, adminUser: AuthenticatedUser) {
    const profileData = await this.getProfileForReview(userId);
    const user = profileData.profile.user;

    if (user.accountStatus === 'active') {
      throw new BadRequestException('This profile is already approved.');
    }

    if (user.accountStatus === 'blocked') {
      throw new BadRequestException('Blocked accounts cannot be approved.');
    }

    await this.db.callProcedure('sp_admin_approve_profile', [
      userId,
      adminUser.sub,
    ]);

    const updatedProfile = await this.getProfileForReview(userId);

    return {
      message: 'Profile approved successfully.',
      profile: updatedProfile.profile,
    };
  }

  async rejectProfile(
    userId: string,
    dto: RejectProfileDto,
    adminUser: AuthenticatedUser,
  ) {
    const profileData = await this.getProfileForReview(userId);
    const user = profileData.profile.user;

    if (user.accountStatus === 'blocked') {
      throw new BadRequestException('Blocked accounts cannot be rejected.');
    }

    await this.db.callProcedure('sp_admin_reject_profile', [
      userId,
      adminUser.sub,
      dto.reason.trim(),
    ]);

    const updatedProfile = await this.getProfileForReview(userId);

    return {
      message: 'Profile rejected successfully.',
      profile: updatedProfile.profile,
    };
  }
}
