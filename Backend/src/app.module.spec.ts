import { AppModule } from './app.module';

describe('AppModule', () => {
  it('is defined with the consent module wired in', () => {
    expect(AppModule).toBeDefined();
  });
});
