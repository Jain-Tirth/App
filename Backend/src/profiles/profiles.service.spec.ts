import { HttpStatus } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApiException } from '../common/api-error';
import type { DatabaseService } from '../database/database.service';
import { SavePersonalDetailsDto } from './dto/save-personal-details.dto';
import { ProfilesService } from './profiles.service';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const USER = { sub: 'user-1' } as Parameters<
  ProfilesService['savePersonalDetails']
>[0];

function fakeDb() {
  const query = jest.fn().mockResolvedValue({
    rowCount: 1,
    rows: [{ id: 'user-1', mobileVerified: true }],
  });
  const callFunction = jest.fn().mockResolvedValue(undefined);
  const callFunctionSingle = jest.fn().mockResolvedValue(null);

  return { query, callFunction, callFunctionSingle };
}

function dto(gender: string, dateOfBirth: string): SavePersonalDetailsDto {
  return plainToInstance(SavePersonalDetailsDto, { gender, dateOfBirth });
}

async function rejection(promise: Promise<unknown>): Promise<ApiException> {
  try {
    await promise;
  } catch (error) {
    return error as ApiException;
  }

  throw new Error('Expected the call to be rejected.');
}

describe('ProfilesService.savePersonalDetails age gate', () => {
  let db: ReturnType<typeof fakeDb>;
  let service: ProfilesService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    db = fakeDb();
    service = new ProfilesService(db as unknown as DatabaseService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves a man who turns 21 today', async () => {
    await service.savePersonalDetails(USER, dto('male', '2005-11-14'));

    expect(db.callFunction).toHaveBeenCalledTimes(1);
  });

  it('rejects a man one day short of 21 and saves nothing', async () => {
    const error = await rejection(
      service.savePersonalDetails(USER, dto('male', '2005-11-15')),
    );

    expect(error.status).toBe(HttpStatus.BAD_REQUEST);
    expect(error.code).toBe('AGE_BELOW_MINIMUM');
    expect(error.details).toEqual({ minimumAge: 21 });
    expect(db.query).not.toHaveBeenCalled();
    expect(db.callFunction).not.toHaveBeenCalled();
  });

  it('saves a woman who turns 18 today', async () => {
    await service.savePersonalDetails(USER, dto('female', '2008-11-14'));

    expect(db.callFunction).toHaveBeenCalledTimes(1);
  });

  it('rejects a woman one day short of 18 and saves nothing', async () => {
    const error = await rejection(
      service.savePersonalDetails(USER, dto('female', '2008-11-15')),
    );

    expect(error.code).toBe('AGE_BELOW_MINIMUM');
    expect(error.details).toEqual({ minimumAge: 18 });
    expect(db.query).not.toHaveBeenCalled();
    expect(db.callFunction).not.toHaveBeenCalled();
  });

  it('rejects a future date of birth with INVALID_DATE_OF_BIRTH', async () => {
    const error = await rejection(
      service.savePersonalDetails(USER, dto('female', '2026-11-15')),
    );

    expect(error.status).toBe(HttpStatus.BAD_REQUEST);
    expect(error.code).toBe('INVALID_DATE_OF_BIRTH');
    expect(db.callFunction).not.toHaveBeenCalled();
  });
});

describe('SavePersonalDetailsDto date of birth', () => {
  it.each(['2000-13-45', '2001-02-29'])(
    'reports a field-level error on dateOfBirth for %s',
    async (value) => {
      const errors = await validate(dto('male', value));

      expect(errors.map((error) => error.property)).toEqual(['dateOfBirth']);
    },
  );

  it('accepts a real calendar date', async () => {
    expect(await validate(dto('male', '2000-02-29'))).toEqual([]);
  });
});
