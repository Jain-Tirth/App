import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ConsentDocumentsController } from './consent-documents.controller';
import { ConsentsService } from './consents.service';

const documentsResponse = {
  language: 'hi',
  documents: [
    {
      code: 'terms',
      version: '1.0',
      hash: 'a'.repeat(64),
      effectiveAt: '2026-11-01T00:00:00.000Z',
      text: 'हिन्दी शर्तें',
    },
  ],
};

describe('ConsentDocumentsController', () => {
  let app: INestApplication;
  const getActiveConsentDocuments = jest.fn(async () => documentsResponse);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConsentDocumentsController],
      providers: [
        {
          provide: ConsentsService,
          useValue: { getActiveConsentDocuments },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    getActiveConsentDocuments.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the active documents without an access token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/consents/documents')
      .expect(200);

    expect(response.body).toEqual(documentsResponse);
    expect(getActiveConsentDocuments).toHaveBeenCalledWith(undefined);
  });

  it('passes the requested language through', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/consents/documents?language=hi')
      .expect(200);

    expect(getActiveConsentDocuments).toHaveBeenCalledWith('hi');
  });

  it('rejects an unsupported explicit language', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/consents/documents?language=xx')
      .expect(400);

    expect(getActiveConsentDocuments).not.toHaveBeenCalled();
  });
});
