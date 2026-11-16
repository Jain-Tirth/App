import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovedProfileGuard } from '../profiles/profile-status.guards';
import {
  EmptyBodyDto,
  ListShortlistProfilesQueryDto,
  ShortlistNameDto,
} from './dto/shortlists.dto';
import { ShortlistsService } from './shortlists.service';

@UseGuards(JwtAuthGuard, ApprovedProfileGuard)
@Controller('shortlists')
export class ShortlistsController {
  constructor(private readonly shortlists: ShortlistsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.shortlists.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: ShortlistNameDto) {
    return this.shortlists.create(user, dto.name);
  }

  @Patch(':id')
  rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ShortlistNameDto,
  ) {
    return this.shortlists.rename(user, id, dto.name);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.shortlists.remove(user, id);
  }

  @Get(':id/profiles')
  profiles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ListShortlistProfilesQueryDto,
  ) {
    return this.shortlists.profiles(user, id, query);
  }

  @HttpCode(200)
  @Put(':id/profiles/:profileRef')
  addProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('profileRef') profileRef: string,
    @Body() _body: EmptyBodyDto,
  ) {
    return this.shortlists.addProfile(user, id, profileRef);
  }

  @HttpCode(204)
  @Delete(':id/profiles/:profileRef')
  async removeProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('profileRef') profileRef: string,
  ) {
    await this.shortlists.removeProfile(user, id, profileRef);
  }
}
