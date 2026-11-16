import { Inject, Injectable } from '@nestjs/common';
import {
  exportLinkExpiry,
  isExportExpired,
  isPurgeDue,
  scheduledPurgeAt,
} from './account.domain';
import {
  accountNotFound,
  accountPurged,
  deleteRequestNotFound,
  exportExpired,
  exportNotFound,
  requestAlreadyPending,
} from './account.errors';
import {
  ACCOUNT_CLOCK,
  ACCOUNT_CONFIG,
  ACCOUNT_REPOSITORY,
  type AccountConfig,
  type AccountRepository,
  type AccountSettings,
  type Clock,
  type ExportArchive,
  type SettingsPatch,
} from './account.types';
import { StepUpService } from './step-up.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Account settings, logout-all, export and deletion. Every call acts on the
 * member id taken from the verified token, never from the request.
 */
@Injectable()
export class AccountService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly repository: AccountRepository,
    private readonly stepUp: StepUpService,
    @Inject(ACCOUNT_CONFIG) private readonly config: AccountConfig,
    @Inject(ACCOUNT_CLOCK) private readonly clock: Clock,
  ) {}

  async getSettings(userId: string): Promise<AccountSettings> {
    const settings = await this.repository.getSettings(userId);

    if (!settings) {
      throw accountNotFound();
    }

    return settings;
  }

  updateSettings(userId: string, patch: SettingsPatch): Promise<AccountSettings> {
    return this.repository.updateSettings(userId, patch);
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.repository.revokeAllSessions(userId);

    return { message: 'Logged out of all devices.' };
  }

  async requestExport(userId: string, password: string) {
    await this.stepUp.verify(userId, password);

    const now = this.clock();
    const created = await this.repository.createExportRequest(
      userId,
      now,
      exportLinkExpiry(now, this.config.exportLinkHours),
    );

    if (created.kind === 'alreadyPending') {
      throw requestAlreadyPending();
    }

    return {
      requestId: created.request.id,
      status: created.request.status,
      expiresAt: created.request.expiresAt.toISOString(),
      downloadPath: `/api/v1/account/export/${created.request.id}`,
    };
  }

  /** Serves the archive of the member's own request while its link is valid. */
  async downloadExport(userId: string, requestId: string): Promise<ExportArchive> {
    if (!UUID.test(requestId)) {
      throw exportNotFound();
    }

    const request = await this.repository.findExportRequest(userId, requestId);

    if (!request) {
      throw exportNotFound();
    }

    const now = this.clock();

    if (isExportExpired(request.expiresAt, now)) {
      throw exportExpired();
    }

    if (request.archive) {
      return request.archive;
    }

    const archive = await this.repository.buildExportArchive(userId, now);
    const stored = await this.repository.storeExportArchive(request.id, archive, now);

    return stored.archive ?? archive;
  }

  async requestDeletion(userId: string, password: string) {
    await this.stepUp.verify(userId, password);

    const requestedAt = this.clock();
    const result = await this.repository.scheduleDeletion(
      userId,
      requestedAt,
      scheduledPurgeAt(requestedAt, this.config.deletionCoolingOffDays),
    );

    if (result.kind === 'alreadyPending') {
      throw requestAlreadyPending();
    }

    return {
      status: 'pending' as const,
      requestedAt: result.state.requestedAt.toISOString(),
      scheduledPurgeAt: result.state.scheduledPurgeAt.toISOString(),
    };
  }

  async cancelDeletion(userId: string): Promise<{ message: string }> {
    const state = await this.repository.findDeletion(userId);

    if (!state) {
      throw deleteRequestNotFound();
    }

    if (isPurgeDue(state.scheduledPurgeAt, this.clock())) {
      throw accountPurged();
    }

    await this.repository.cancelDeletion(userId);

    return { message: 'Account deletion cancelled.' };
  }
}
