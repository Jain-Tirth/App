import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SaveAdditionalDetailsDto } from './dto/save-additional-details.dto';
import { SaveLocationDetailsDto } from './dto/save-location-details.dto';
import { SavePersonalDetailsDto } from './dto/save-personal-details.dto';
import { SaveProfessionalDetailsDto } from './dto/save-professional-details.dto';
import { SaveReligiousDetailsDto } from './dto/save-religious-details.dto';
import {
  ApprovedProfileGuard,
  EditableProfileGuard,
} from './profile-status.guards';
import { ProfileSubmissionService } from './profile-submission.service';
import { ProfilesService } from './profiles.service';

@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly submissionService: ProfileSubmissionService,
  ) {}

  @Get('me')
  getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getMyProfile(user);
  }

  @UseGuards(ApprovedProfileGuard)
  @Get('matches')
  getActiveMatches(@CurrentUser() user: AuthenticatedUser) {
    return this.profilesService.getActiveMatches(user);
  }

  @HttpCode(200)
  @Post('submit')
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.submissionService.submit(user.sub);
  }

  @HttpCode(200)
  @Post('withdraw')
  withdraw(@CurrentUser() user: AuthenticatedUser) {
    return this.submissionService.withdraw(user.sub);
  }

  @UseGuards(EditableProfileGuard)
  @Put('step-1')
  savePersonalDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SavePersonalDetailsDto,
  ) {
    return this.profilesService.savePersonalDetails(user, dto);
  }

  @UseGuards(EditableProfileGuard)
  @Put('step-2')
  saveReligiousDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveReligiousDetailsDto,
  ) {
    return this.profilesService.saveReligiousDetails(user, dto);
  }

  @UseGuards(EditableProfileGuard)
  @Put('step-3')
  saveLocationDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveLocationDetailsDto,
  ) {
    return this.profilesService.saveLocationDetails(user, dto);
  }

  @UseGuards(EditableProfileGuard)
  @Put('step-4')
  saveProfessionalDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveProfessionalDetailsDto,
  ) {
    return this.profilesService.saveProfessionalDetails(user, dto);
  }

  @UseGuards(EditableProfileGuard)
  @Put('step-5')
  saveAdditionalDetails(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveAdditionalDetailsDto,
  ) {
    return this.profilesService.saveAdditionalDetails(user, dto);
  }
}
