import { useCallback, useEffect, useRef } from 'react';
import { drafts, type DraftAllowList, type DraftValues } from './drafts';
import { setFormDirty } from './dirtyForms';

const SAVE_DELAY_MS = 400;

interface Options {
  formId: string;
  /** Null disables the local copy (no member id known). */
  userId: string | null;
  values: DraftValues;
  allowed: DraftAllowList;
  onRestore: (restored: DraftValues) => void;
}

/**
 * Keeps a local copy of unsaved step values (per user id, in IndexedDB) and reports dirtiness to
 * the update prompt. A group counts as dirty while it differs from its last saved value; only dirty
 * groups are written. Best effort: storage failures are silent and never block the form.
 */
export function useFormDraft({ formId, userId, values, allowed, onRestore }: Options) {
  const baselines = useRef<Record<string, string>>({});
  const latest = useRef(values);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  /** Nothing is written or discarded until the stored draft has been read, so a slow read is never overwritten. */
  const loaded = useRef(false);
  const restore = useRef(onRestore);
  restore.current = onRestore;
  latest.current = values;

  if (Object.keys(baselines.current).length === 0) {
    for (const group of Object.keys(allowed)) baselines.current[group] = JSON.stringify(values[group]);
  }

  const dirtyGroups = useCallback((): DraftValues => {
    const out: DraftValues = {};
    for (const group of Object.keys(allowed)) {
      if (JSON.stringify(latest.current[group]) !== baselines.current[group]) out[group] = latest.current[group];
    }
    return out;
  }, [allowed]);

  const persist = useCallback(() => {
    if (!userId || !alive.current || !loaded.current) return;
    const dirty = dirtyGroups();
    const task =
      Object.keys(dirty).length > 0 ? drafts.save(userId, formId, dirty, allowed) : drafts.discard(userId, formId);
    void task.catch(() => undefined);
  }, [allowed, dirtyGroups, formId, userId]);

  useEffect(() => {
    alive.current = true;
    if (userId) {
      void drafts
        .load(userId, formId, allowed)
        .then((restored) => {
          if (restored && alive.current) restore.current(restored);
        })
        .catch(() => undefined)
        .finally(() => {
          loaded.current = true;
        });
    }
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      setFormDirty(formId, false);
    };
  }, [allowed, formId, userId]);

  const signature = JSON.stringify(values);
  useEffect(() => {
    setFormDirty(formId, Object.keys(dirtyGroups()).length > 0);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, SAVE_DELAY_MS);
  }, [signature, dirtyGroups, formId, persist]);

  /** Call after a group was saved to the server: it is clean again and leaves the draft. */
  const markSaved = useCallback(
    (group: string) => {
      baselines.current[group] = JSON.stringify(latest.current[group]);
      setFormDirty(formId, Object.keys(dirtyGroups()).length > 0);
      if (timer.current) clearTimeout(timer.current);
      persist();
    },
    [dirtyGroups, formId, persist],
  );

  return { markSaved };
}
