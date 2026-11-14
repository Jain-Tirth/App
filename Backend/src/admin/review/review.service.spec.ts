import { AdminReviewService } from './review.service';
import type { ReviewRepository } from './review.repository';
import type { ReviewSubject } from './review.types';
import type { ObjectStorage } from '../../storage/object-storage';

const NOW = new Date('2026-11-09T04:00:00.000Z');

function subject(overrides: Partial<ReviewSubject>): ReviewSubject {
  return {
    userId: 'u1',
    profileUid: 'P-1',
    name: 'Member',
    gender: 'female',
    dateOfBirth: '1998-01-01',
    accountStatus: 'pending',
    kycStatus: 'pending_review',
    documentType: 'aadhaar',
    idNumberLast4: '1234',
    photo: { storageKey: 'photo-key', contentType: 'image/jpeg' },
    idDocument: { storageKey: 'id-key', contentType: 'image/jpeg' },
    submittedAt: NOW,
    ...overrides,
  };
}

function build(found: ReviewSubject) {
  const repository = {
    findSubject: async () => found,
  } as unknown as ReviewRepository;
  const storage = {
    createReadUrl: async () => ({
      url: 'https://files.test/photo',
      expiresAt: new Date('2026-11-09T04:05:00.000Z'),
    }),
  } as unknown as ObjectStorage;

  return new AdminReviewService(
    repository,
    storage,
    () => NOW,
    {
      slaHours: 48,
      days: [1, 2, 3, 4, 5],
      startMinute: 540,
      endMinute: 1080,
      timeZone: 'Asia/Kolkata',
    },
    { male: 21, female: 18 },
  );
}

describe('AdminReviewService workspace age check', () => {
  it('fails closed with a null age when the date of birth is missing', async () => {
    const result = await build(subject({ dateOfBirth: null })).getWorkspace('u1');

    expect(result.age).toBeNull();
    expect(result.ageCheck).toBe('fail');
  });

  it('fails closed with a null age when the gender is missing', async () => {
    const result = await build(subject({ gender: null })).getWorkspace('u1');

    expect(result.age).toBeNull();
    expect(result.ageCheck).toBe('fail');
  });

  it('passes with the real age for an adult female born 1998-01-01', async () => {
    const result = await build(subject({})).getWorkspace('u1');

    expect(result.age).toBe(28);
    expect(result.ageCheck).toBe('pass');
  });
});
