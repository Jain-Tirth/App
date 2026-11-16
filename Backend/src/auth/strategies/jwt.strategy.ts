import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../config/env';
import { DatabaseService } from '../../database/database.service';
import { AuthenticatedUser, AuthTokenPayload } from '../auth.types';

/**
 * Verifies the access token signature and expiry, then reads the member's
 * current session version and deletion state in one primary-key lookup. That
 * lookup is what makes logout-all take effect on the very next request, and
 * what rejects a member whose account has been purged.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.secret,
    });
  }

  async validate(payload: AuthTokenPayload): Promise<AuthenticatedUser> {
    const result = await this.db.query(
      `SELECT "sessionVersion", "deletionScheduledPurgeAt"
       FROM "Users" WHERE "id" = $1`,
      [payload.sub],
    );
    const member = result.rows[0];

    if (!member || member.sessionVersion !== (payload.sv ?? 0)) {
      throw new UnauthorizedException('Your session has ended. Log in again.');
    }

    return {
      ...payload,
      deletionScheduledPurgeAt: member.deletionScheduledPurgeAt
        ? new Date(member.deletionScheduledPurgeAt)
        : null,
    };
  }
}
