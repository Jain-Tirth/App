import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { env } from '../config/env';

/**
 * Admin sessions are signed with the admin secret. A request without a valid
 * admin token is 401, except that a valid member token is a known, signed-in
 * caller who lacks the admin role, so it is 403 (never 401, never allowed).
 */
@Injectable()
export class AdminJwtAuthGuard extends AuthGuard('admin-jwt') {
  constructor(private readonly jwt: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      const request = context.switchToHttp().getRequest<Request>();

      if (await this.isMemberToken(request)) {
        throw new ForbiddenException('You do not have access to this resource.');
      }

      throw error;
    }
  }

  private async isMemberToken(request: Request): Promise<boolean> {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return false;
    }

    try {
      await this.jwt.verifyAsync(token, { secret: env.jwt.secret });
      return true;
    } catch {
      return false;
    }
  }
}
