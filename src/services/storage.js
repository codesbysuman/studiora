import { LEGACY_STORAGE_KEY, OLDER_LEGACY_STORAGE_KEY, STORAGE_KEY, seedNotes } from '../config.js';
import { createOriginLibrary, importLibrary, materializeLibrary, exportLibrary } from './library.js';

const DB_NAME = 'studiora';
const DB_VERSION = 1;
const STORE_NAME = 'libraries';
const LIBRARY_ID_KEY = 'primary';

function clone(value) {
  return structuredClone(value);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open IndexedDB.'));
  });
}

export async function readLibraryFromIndexedDB() {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(LIBRARY_ID_KEY);
      request.onsuccess = () => resolve(request.result ? clone(request.result) : null);
      request.onerror = () => reject(request.error || new Error('Could not read the library.'));
    });
  } finally {
    db.close();
  }
}

export async function writeLibraryToIndexedDB(library) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(clone(library), LIBRARY_ID_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not save the library.'));
      transaction.onabort = () => reject(transaction.error || new Error('Library save was aborted.'));
    });
  } finally {
    db.close();
  }
}

function readLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return importLibrary(JSON.parse(raw));

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const library = importLibrary(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      return library;
    }

    const olderLegacy = localStorage.getItem(OLDER_LEGACY_STORAGE_KEY);
    if (olderLegacy) {
      const notes = JSON.parse(olderLegacy);
      const library = createOriginLibrary(Array.isArray(notes) ? notes : clone(seedNotes));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      return library;
    }
  } catch (error) {
    console.warn('Could not read the local library cache.', error);
  }
  return createOriginLibrary(clone(seedNotes));
}

export function loadLibrary() {
  return readLocalCache();
}

export function saveLibrary(library) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  void writeLibraryToIndexedDB(library).catch(error => {
    console.warn('IndexedDB save failed; LocalStorage cache remains available.', error);
  });
}

export async function hydrateLibraryFromIndexedDB(onLibrary) {
  try {
    const local = loadLibrary();
    const indexed = await readLibraryFromIndexedDB();
    if (!indexed) {
      await writeLibraryToIndexedDB(local);
      return false;
    }

    if (indexed.headPatchId === local.headPatchId) return false;

    const localCount = Array.isArray(local.patches) ? local.patches.length : 0;
    const indexedCount = Array.isArray(indexed.patches) ? indexed.patches.length : 0;
    const localTime = Date.parse(local.patches?.at(-1)?.timestamp || '') || 0;
    const indexedTime = Date.parse(indexed.patches?.at(-1)?.timestamp || '') || 0;

    // Prefer the newer/more advanced patch chain. This avoids an async IndexedDB read
    // overwriting a change made after first paint while still recovering a newer IDB copy.
    if (localCount > indexedCount || (localCount === indexedCount && localTime > indexedTime)) {
      await writeLibraryToIndexedDB(local);
      return false;
    }

    onLibrary(importLibrary(indexed));
    return true;
  } catch (error) {
    console.warn('IndexedDB hydration skipped.', error);
  }
  return false;
}

export function exportLibraryFile(library) {
  const payload = exportLibrary(library);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `studiora_library_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function libraryState(library) {
  return materializeLibrary(library);
}
