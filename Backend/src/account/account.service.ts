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
  type AuditContext,
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

  async logoutAll(userId: string, audit: AuditContext): Promise<{ message: string }> {
    await this.repository.revokeAllSessions(userId, audit);

    return { message: 'Logged out of all devices.' };
  }

  async requestExport(userId: string, password: string, audit: AuditContext) {
    await this.stepUp.verify(userId, password);

    const now = this.clock();
    const created = await this.repository.createExportRequest(
      userId,
      now,
      exportLinkExpiry(now, this.config.exportLinkHours),
      audit,
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
  async downloadExport(
    userId: string,
    requestId: string,
    audit: AuditContext,
  ): Promise<ExportArchive> {
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

    // Recorded before the data leaves: a failed audit write refuses the download.
    await this.repository.recordExportDownload(userId, request.id, audit);

    if (request.archive) {
      return request.archive;
    }

    const archive = await this.repository.buildExportArchive(userId, now);
    const stored = await this.repository.storeExportArchive(request.id, archive, now);

    return stored.archive ?? archive;
  }

  /**
   * A member who already has a pending deletion cannot reach this route (the
   * guard confines them to cancelling), so there is no 409: should two
   * requests race, both receive the one schedule.
   */
  async requestDeletion(userId: string, password: string, audit: AuditContext) {
    await this.stepUp.verify(userId, password);

    const requestedAt = this.clock();
    const state = await this.repository.scheduleDeletion(
      userId,
      requestedAt,
      scheduledPurgeAt(requestedAt, this.config.deletionCoolingOffDays),
      audit,
    );

    return {
      status: 'pending' as const,
      requestedAt: state.requestedAt.toISOString(),
      scheduledPurgeAt: state.scheduledPurgeAt.toISOString(),
    };
  }

  async cancelDeletion(
    userId: string,
    audit: AuditContext,
  ): Promise<{ message: string }> {
    const state = await this.repository.findDeletion(userId);

    if (!state) {
      throw deleteRequestNotFound();
    }

    if (isPurgeDue(state.scheduledPurgeAt, this.clock())) {
      throw accountPurged();
    }

    await this.repository.cancelDeletion(userId, audit);

    return { message: 'Account deletion cancelled.' };
  }
}
