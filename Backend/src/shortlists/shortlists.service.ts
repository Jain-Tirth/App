import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { profileNotFound } from '../discovery/discovery.errors';
import {
  DISCOVERY_REPOSITORY,
  type AgeMinimums,
  type DiscoveryCard,
  type DiscoveryRepository,
} from '../discovery/discovery.types';
// The keyset cursor is the same (UTC microsecond time, uuid) pair.
import { decodeInterestCursor, encodeInterestCursor } from '../interests/interest-cursor';
import { ShortlistLimitsService } from './shortlist-limits.service';
import {
  cannotShortlistSelf,
  defaultShortlistProtected,
  shortlistNameTaken,
  shortlistNotFound,
} from './shortlist.errors';
import {
  DEFAULT_SHORTLIST_PAGE_SIZE,
  SHORTLIST_AGE_MINIMUMS,
  SHORTLIST_REPOSITORY,
  type ShortlistRecord,
  type ShortlistRepository,
} from './shortlist.types';

const PROFILE_REF = /^[0-9a-f]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ShortlistView {
  id: string;
  name: string;
  isDefault: boolean;
  profileCount: number;
  createdAt: string;
}

function view(record: ShortlistRecord): ShortlistView {
  return {
    id: record.id,
    name: record.name,
    isDefault: record.isDefault,
    profileCount: record.profileCount,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class ShortlistsService {
  constructor(
    @Inject(SHORTLIST_REPOSITORY) private readonly repository: ShortlistRepository,
    @Inject(DISCOVERY_REPOSITORY) private readonly discovery: DiscoveryRepository,
    @Inject(SHORTLIST_AGE_MINIMUMS) private readonly ageMinimums: AgeMinimums,
    private readonly limits: ShortlistLimitsService,
  ) {}

  async list(user: AuthenticatedUser): Promise<ShortlistView[]> {
    return (await this.repository.listLists(user.sub)).map(view);
  }

  async create(user: AuthenticatedUser, name: string): Promise<ShortlistView> {
    const outcome = await this.repository.createList({ userId: user.sub, name }, (existing) =>
      this.limits.assertCanCreateList(existing),
    );

    if (outcome.kind === 'nameTaken') {
      throw shortlistNameTaken();
    }

    return view(outcome.list);
  }

  async rename(user: AuthenticatedUser, id: string, name: string): Promise<ShortlistView> {
    const listId = this.listId(id);
    const outcome = await this.repository.renameList({ userId: user.sub, listId, name });

    switch (outcome.kind) {
      case 'notFound':
        throw shortlistNotFound();
      case 'protected':
        throw defaultShortlistProtected();
      case 'nameTaken':
        throw shortlistNameTaken();
      default:
        return view(outcome.list);
    }
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const outcome = await this.repository.deleteList({
      userId: user.sub,
      listId: this.listId(id),
    });

    if (outcome.kind === 'notFound') {
      throw shortlistNotFound();
    }

    if (outcome.kind === 'protected') {
      throw defaultShortlistProtected();
    }
  }

  async addProfile(
    user: AuthenticatedUser,
    id: string,
    profileRef: string,
  ): Promise<{ added: true }> {
    const listId = this.listId(id);

    await this.assertOwns(user.sub, listId);

    const targetId = await this.resolveTarget(user.sub, profileRef);
    const owned = await this.repository.addProfile(
      { userId: user.sub, listId, targetId },
      ({ distinctProfiles, alreadyShortlisted }) =>
        this.limits.assertCanAddProfile(distinctProfiles, alreadyShortlisted),
    );

    if (!owned) {
      throw shortlistNotFound();
    }

    return { added: true };
  }

  async removeProfile(user: AuthenticatedUser, id: string, profileRef: string): Promise<void> {
    const listId = this.listId(id);

    await this.assertOwns(user.sub, listId);

    // The profile may have stopped being visible since it was added, so only
    // existence is looked up here, never visibility.
    const targetId = PROFILE_REF.test(profileRef)
      ? await this.repository.findUserIdByProfileRef(profileRef)
      : null;

    if (!targetId) {
      return;
    }

    if (!(await this.repository.removeProfile({ userId: user.sub, listId, targetId }))) {
      throw shortlistNotFound();
    }
  }

  async profiles(
    user: AuthenticatedUser,
    id: string,
    query: { limit?: number; cursor?: string },
  ): Promise<{ items: DiscoveryCard[]; nextCursor: string | null }> {
    const listId = this.listId(id);

    await this.assertOwns(user.sub, listId);

    const limit = query.limit ?? DEFAULT_SHORTLIST_PAGE_SIZE;
    const rows = await this.repository.listProfiles({
      userId: user.sub,
      listId,
      ageMinimums: this.ageMinimums,
      after: query.cursor ? decodeInterestCursor(query.cursor) : null,
      fetch: limit + 1,
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];

    return {
      items: page.map((row) => row.member),
      nextCursor:
        rows.length > limit
          ? encodeInterestCursor({ createdAt: last.cursorAt, id: last.cursorId })
          : null,
    };
  }

  private listId(raw: string): string {
    if (!UUID.test(raw)) {
      throw shortlistNotFound();
    }

    return raw.toLowerCase();
  }

  private async assertOwns(userId: string, listId: string): Promise<void> {
    if (!(await this.repository.ownsList(userId, listId))) {
      throw shortlistNotFound();
    }
  }

  /** One 404 body for malformed, unknown, hidden and non-approved profiles. */
  private async resolveTarget(callerId: string, profileRef: string): Promise<string> {
    if (!PROFILE_REF.test(profileRef)) {
      throw profileNotFound();
    }

    const ownerId = await this.repository.findUserIdByProfileRef(profileRef);

    if (!ownerId) {
      throw profileNotFound();
    }

    if (ownerId === callerId) {
      throw cannotShortlistSelf();
    }

    const visible = await this.discovery.findVisibleProfile(
      callerId,
      this.ageMinimums,
      profileRef,
    );

    if (!visible) {
      throw profileNotFound();
    }

    return visible.viewedUserId;
  }
}
