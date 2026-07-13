"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const save_additional_details_dto_1 = require("./dto/save-additional-details.dto");
const save_location_details_dto_1 = require("./dto/save-location-details.dto");
const save_personal_details_dto_1 = require("./dto/save-personal-details.dto");
const save_professional_details_dto_1 = require("./dto/save-professional-details.dto");
const save_religious_details_dto_1 = require("./dto/save-religious-details.dto");
const profiles_service_1 = require("./profiles.service");
let ProfilesController = class ProfilesController {
    profilesService;
    constructor(profilesService) {
        this.profilesService = profilesService;
    }
    getMyProfile(user) {
        return this.profilesService.getMyProfile(user);
    }
    savePersonalDetails(user, dto) {
        return this.profilesService.savePersonalDetails(user, dto);
    }
    saveReligiousDetails(user, dto) {
        return this.profilesService.saveReligiousDetails(user, dto);
    }
    saveLocationDetails(user, dto) {
        return this.profilesService.saveLocationDetails(user, dto);
    }
    saveProfessionalDetails(user, dto) {
        return this.profilesService.saveProfessionalDetails(user, dto);
    }
    saveAdditionalDetails(user, dto) {
        return this.profilesService.saveAdditionalDetails(user, dto);
    }
};
exports.ProfilesController = ProfilesController;
__decorate([
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "getMyProfile", null);
__decorate([
    (0, common_1.Put)('step-1'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_personal_details_dto_1.SavePersonalDetailsDto]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "savePersonalDetails", null);
__decorate([
    (0, common_1.Put)('step-2'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_religious_details_dto_1.SaveReligiousDetailsDto]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "saveReligiousDetails", null);
__decorate([
    (0, common_1.Put)('step-3'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_location_details_dto_1.SaveLocationDetailsDto]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "saveLocationDetails", null);
__decorate([
    (0, common_1.Put)('step-4'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_professional_details_dto_1.SaveProfessionalDetailsDto]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "saveProfessionalDetails", null);
__decorate([
    (0, common_1.Put)('step-5'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, save_additional_details_dto_1.SaveAdditionalDetailsDto]),
    __metadata("design:returntype", void 0)
], ProfilesController.prototype, "saveAdditionalDetails", null);
exports.ProfilesController = ProfilesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('profiles'),
    __metadata("design:paramtypes", [profiles_service_1.ProfilesService])
], ProfilesController);
//# sourceMappingURL=profiles.controller.js.map