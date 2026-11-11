import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

/**
 * Boots the real application module (including the global `/api/v1` prefix and
 * the JWT guard) so the bootstrap contract is covered by an e2e test.
 *
 * Feature-level acceptance criteria live in the repo-root `tests/e2e/*.api.mjs`
 * suites, run with `npm run test:api` against a disposable database.
 */
describe('Application bootstrap (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('does not expose a route at the server root', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  it('mounts the consent API under /api/v1 behind authentication', () => {
    return request(app.getHttpServer())
      .get('/api/v1/consents/current')
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
