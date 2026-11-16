import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllowWhileDeletionPending } from '../decorators/allow-while-deletion-pending.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class Routes {
  blocked() {}

  @AllowWhileDeletionPending()
  allowed() {}
}

const member = { sub: 'u1', email: 'a@example.com', role: 'user' as const };

function contextFor(handler: () => void): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Routes,
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard with a pending account deletion', () => {
  const guard = new JwtAuthGuard(new Reflector());
  const scheduled = new Date('2026-12-16T10:00:00.000Z');
  const pending = { ...member, deletionScheduledPurgeAt: scheduled };

  it('lets a member with no deletion pending through', () => {
    expect(
      guard.handleRequest(null, { ...member, deletionScheduledPurgeAt: null }, null, contextFor(Routes.prototype.blocked)),
    ).toMatchObject({ sub: 'u1' });
  });

  it('refuses every route not marked as allowed, naming the purge date', () => {
    try {
      guard.handleRequest(null, pending, null, contextFor(Routes.prototype.blocked));
      throw new Error('expected a refusal');
    } catch (error: any) {
      expect(error.status).toBe(403);
      expect(error.code).toBe('ACCOUNT_DELETION_PENDING');
      expect(error.details).toEqual({ scheduledPurgeAt: '2026-12-16T10:00:00.000Z' });
    }
  });

  it('lets a route marked as allowed through (cancel, logout)', () => {
    expect(
      guard.handleRequest(null, pending, null, contextFor(Routes.prototype.allowed)),
    ).toMatchObject({ sub: 'u1' });
  });

  it('still rejects a missing user with 401', () => {
    expect(() =>
      guard.handleRequest(null, false, null, contextFor(Routes.prototype.blocked)),
    ).toThrow();
  });
});
