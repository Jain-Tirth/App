import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SaveAdditionalDetailsDto } from './dto/save-additional-details.dto';
import { SaveLocationDetailsDto } from './dto/save-location-details.dto';
import { SavePersonalDetailsDto } from './dto/save-personal-details.dto';
import { SaveProfessionalDetailsDto } from './dto/save-professional-details.dto';
import { SaveReligiousDetailsDto } from './dto/save-religious-details.dto';
import { ProfilesService } from './profiles.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getMyProfile(user);
  }

  @Put('step-1')
  savePersonalDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SavePersonalDetailsDto,
  ) {
    return this.profilesService.savePersonalDetails(user, dto);
  }

  @Put('step-2')
  saveReligiousDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveReligiousDetailsDto,
  ) {
    return this.profilesService.saveReligiousDetails(user, dto);
  }

  @Put('step-3')
  saveLocationDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveLocationDetailsDto,
  ) {
    return this.profilesService.saveLocationDetails(user, dto);
  }

  @Put('step-4')
  saveProfessionalDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveProfessionalDetailsDto,
  ) {
    return this.profilesService.saveProfessionalDetails(user, dto);
  }

  @Put('step-5')
  saveAdditionalDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveAdditionalDetailsDto,
  ) {
    return this.profilesService.saveAdditionalDetails(user, dto);
  }
}
