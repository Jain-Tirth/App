import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { env } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { AdminLoginDto } from './dto/admin-login.dto';

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
        secret: env.admin.jwtSecret,
        expiresIn: env.admin.jwtExpiresIn as StringValue,
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

}
