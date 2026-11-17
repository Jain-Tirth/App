import { describe, expect, it, vi } from 'vitest';
import { createReloadGuard, requestUpdate } from './updateController';

describe('requestUpdate', () => {
  it('sends skip-waiting when no form is dirty', () => {
    const postMessage = vi.fn();
    expect(requestUpdate({ waiting: { postMessage }, isDirty: () => false })).toBe('applying');
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('sends nothing while a step form is dirty', () => {
    const postMessage = vi.fn();
    expect(requestUpdate({ waiting: { postMessage }, isDirty: () => true })).toBe('blocked-dirty');
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('does nothing without a waiting worker', () => {
    expect(requestUpdate({ waiting: null, isDirty: () => false })).toBe('nothing-waiting');
  });
});

describe('createReloadGuard', () => {
  it('does not reload before an update was requested', () => {
    const reload = vi.fn();
    createReloadGuard(reload).onControllerChange();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads exactly once after a request, even if controllerchange fires again', () => {
    const reload = vi.fn();
    const guard = createReloadGuard(reload);
    guard.markRequested();
    guard.onControllerChange();
    guard.onControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
