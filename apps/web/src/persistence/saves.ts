import type { SaveMeta } from '@city/shared';

const DB_NAME = 'city-builder';
const DB_VERSION = 1;
/** Small records listed by the menu, kept apart from the (large) save text. */
const META_STORE = 'meta';
const DATA_STORE = 'data';

export const AUTOSAVE_ID = 'autosave';

export interface SaveSlot extends SaveMeta {
  id: string;
  autosave: boolean;
  bytes: number;
}

export type StorageErrorKind = 'quota' | 'unavailable' | 'missing' | 'unknown';

export class SaveStorageError extends Error {
  constructor(
    readonly kind: StorageErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SaveStorageError';
  }
}

/** Slot of the manual save of a city: one per name and seed. */
export function manualSlotId(name: string, seed: string): string {
  return `city:${seed}:${name}`;
}

function toStorageError(error: unknown): SaveStorageError {
  if (error instanceof SaveStorageError) return error;
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  if (name === 'QuotaExceededError') return new SaveStorageError('quota', message);
  if (name === 'InvalidStateError' || name === 'SecurityError') {
    return new SaveStorageError('unavailable', message);
  }
  return new SaveStorageError('unknown', message);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new SaveStorageError('unavailable', 'IndexedDB is not available'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE))
        db.createObjectStore(META_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DATA_STORE))
        db.createObjectStore(DATA_STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error));
    request.onblocked = () => reject(new SaveStorageError('unavailable', 'database blocked'));
  }).catch((error: unknown) => {
    dbPromise = null;
    throw toStorageError(error);
  });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(toStorageError(tx.error));
    tx.onerror = () => reject(toStorageError(tx.error));
  });
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(toStorageError(request.error));
  });
}

/** Saves, most recent first. */
export async function listSaves(): Promise<SaveSlot[]> {
  const db = await openDb();
  const tx = db.transaction(META_STORE, 'readonly');
  const slots = await result(tx.objectStore(META_STORE).getAll() as IDBRequest<SaveSlot[]>);
  return slots.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

export async function writeSave(slot: SaveSlot, text: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
    tx.objectStore(DATA_STORE).put({ id: slot.id, text });
    tx.objectStore(META_STORE).put(slot);
    await done(tx);
  } catch (error) {
    throw toStorageError(error);
  }
}

export async function readSave(id: string): Promise<string> {
  const db = await openDb();
  const tx = db.transaction(DATA_STORE, 'readonly');
  const record = await result(
    tx.objectStore(DATA_STORE).get(id) as IDBRequest<{ id: string; text: string } | undefined>,
  );
  if (!record || typeof record.text !== 'string') {
    throw new SaveStorageError('missing', `save ${id} has no data`);
  }
  return record.text;
}

export async function deleteSave(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META_STORE, DATA_STORE], 'readwrite');
  tx.objectStore(META_STORE).delete(id);
  tx.objectStore(DATA_STORE).delete(id);
  await done(tx);
}
