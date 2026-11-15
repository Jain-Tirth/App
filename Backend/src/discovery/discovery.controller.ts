import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovedProfileGuard } from '../profiles/profile-status.guards';
import { SearchQueryDto } from './dto/search-query.dto';
import { DiscoveryService } from './discovery.service';
import { ProfileRefPipe } from './profile-ref.pipe';

@UseGuards(JwtAuthGuard, ApprovedProfileGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get('recommendations')
  async recommendations(@CurrentUser() user: AuthenticatedUser) {
    return { items: await this.discovery.dailyRecommendations(user) };
  }

  @Get('search')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SearchQueryDto,
  ) {
    return this.discovery.search(user, query);
  }
}

/**
 * Registered after `ProfilesController` in `ProfilesModule` so the literal
 * `/profiles/me` and `/profiles/matches` routes are matched first.
 */
@UseGuards(JwtAuthGuard, ApprovedProfileGuard)
@Controller('profiles')
export class ProfileDetailController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Get(':profileRef')
  getProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileRef', ProfileRefPipe) profileRef: string,
  ) {
    return this.discovery.getProfile(user, profileRef);
  }
}
