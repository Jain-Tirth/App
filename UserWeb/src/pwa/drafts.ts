/**
 * Local copy of unsaved step-form values, keyed by user id, stored in IndexedDB and wiped on logout.
 * Only fields named in an allow-list are ever written, so government-ID data (which is never part
 * of a step form) cannot reach the store even if a caller passes it by mistake.
 */

export type Primitive = string | number | boolean;
export type DraftValues = Record<string, Record<string, Primitive>>;
/** group name -> field names that may be stored. */
export type DraftAllowList = Record<string, readonly string[]>;

export interface DraftStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  clearAll(): Promise<void>;
}

function isPrimitive(value: unknown): value is Primitive {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** Keeps only allow-listed groups and fields whose value is a primitive. Never throws. */
export function sanitizeDraft(raw: unknown, allowed: DraftAllowList): DraftValues {
  const out: DraftValues = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [group, fields] of Object.entries(allowed)) {
    const source = (raw as Record<string, unknown>)[group];
    if (!source || typeof source !== 'object') continue;
    const picked: Record<string, Primitive> = {};
    for (const field of fields) {
      const value = (source as Record<string, unknown>)[field];
      if (isPrimitive(value)) picked[field] = value;
    }
    if (Object.keys(picked).length > 0) out[group] = picked;
  }
  return out;
}

function storeKey(userId: string, formId: string): string {
  return `${userId}\u0000${formId}`;
}

export function createDraftService(store: DraftStore) {
  return {
    async load(userId: string, formId: string, allowed: DraftAllowList): Promise<DraftValues | null> {
      const stored = await store.get(storeKey(userId, formId));
      if (stored === undefined) return null;
      const clean = sanitizeDraft(stored, allowed);
      return Object.keys(clean).length > 0 ? clean : null;
    },
    async save(userId: string, formId: string, values: unknown, allowed: DraftAllowList): Promise<void> {
      await store.put(storeKey(userId, formId), sanitizeDraft(values, allowed));
    },
    async discard(userId: string, formId: string): Promise<void> {
      await store.remove(storeKey(userId, formId));
    },
    /** Logout: removes every member's drafts on this device. */
    async clearAll(): Promise<void> {
      await store.clearAll();
    },
  };
}

export function createMemoryDraftStore(): DraftStore {
  const map = new Map<string, unknown>();
  return {
    async get(key) {
      return map.get(key);
    },
    async put(key, value) {
      map.set(key, value);
    },
    async remove(key) {
      map.delete(key);
    },
    async clearAll() {
      map.clear();
    },
  };
}

const DB_NAME = 'dhobi-drafts';
const STORE_NAME = 'drafts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function createIndexedDbDraftStore(): DraftStore {
  return {
    get: (key) => withStore('readonly', (s) => s.get(key)),
    put: async (key, value) => {
      await withStore('readwrite', (s) => s.put(value, key));
    },
    remove: async (key) => {
      await withStore('readwrite', (s) => s.delete(key));
    },
    clearAll: async () => {
      await withStore('readwrite', (s) => s.clear());
    },
  };
}

/** The app-wide draft service. Falls back to an in-memory store where IndexedDB is unavailable. */
export const drafts = createDraftService(
  typeof indexedDB === 'undefined' ? createMemoryDraftStore() : createIndexedDbDraftStore(),
);
