const SCHEMA_VERSION = 2;

function clone(value) { return structuredClone(value); }
function makeId(prefix = 'patch') {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.randomUUID) return `${prefix}_${webCrypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function pointerEscape(value) { return String(value).replaceAll('~', '~0').replaceAll('/', '~1'); }
function pointerUnescape(value) { return String(value).replaceAll('~1', '/').replaceAll('~0', '~'); }
function getAt(root, path) {
  if (path === '') return root;
  return path.slice(1).split('/').map(pointerUnescape).reduce((node, key) => node?.[key], root);
}
function ensureAppendableArray(node, key, path) {
  if (Array.isArray(node[key])) return;
  if (node[key] && typeof node[key] === 'object') node[key] = Object.values(node[key]).filter(item => item && typeof item === 'object');
  else node[key] = [];
  if (!Array.isArray(node[key])) throw new Error(`Cannot append to non-array path: ${path}`);
}

function setAt(root, path, value) {
  if (path === '') return value;
  const parts = path.slice(1).split('/').map(pointerUnescape); const key = parts.pop(); let node = root;
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (node[part] == null) node[part] = (index === parts.length - 1 && key === '-') ? [] : {};
    if (index === parts.length - 1 && key === '-' && !Array.isArray(node[part])) ensureAppendableArray(node, part, path);
    node = node[part];
  }
  if (key === '-' && !Array.isArray(node)) {
    throw new Error(`Cannot append to non-array path: ${path}`);
  }
  if (Array.isArray(node) && key === '-') node.push(value);
  else node[key] = value;
  return root;
}
function removeAt(root, path) {
  if (path === '') return undefined;
  const parts = path.slice(1).split('/').map(pointerUnescape); const key = parts.pop(); let node = root;
  for (const part of parts) node = node?.[part];
  if (node == null) return root;
  if (Array.isArray(node)) node.splice(Number(key), 1); else delete node[key];
  return root;
}

export function applyChanges(base, changes = []) {
  let result = clone(base);
  for (const change of changes) {
    if (change.op === 'add' || change.op === 'replace') result = setAt(result, change.path, clone(change.value));
    else if (change.op === 'remove') result = removeAt(result, change.path);
    else throw new Error(`Unsupported patch operation: ${change.op}`);
  }
  return result;
}

export function diffValues(before, after, path = '') {
  if (Object.is(before, after)) return [];
  if (before === undefined) return [{ op: 'add', path, value: clone(after) }];
  if (after === undefined) return [{ op: 'remove', path }];
  if (typeof before !== 'object' || before === null || typeof after !== 'object' || after === null) return [{ op: 'replace', path, value: clone(after) }];
  if (Array.isArray(before) || Array.isArray(after)) return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ op: 'replace', path, value: clone(after) }];
  const changes = [];
  for (const key of Object.keys(before)) if (!(key in after)) changes.push(...diffValues(before[key], undefined, `${path}/${pointerEscape(key)}`));
  for (const key of Object.keys(after)) changes.push(...diffValues(before[key], after[key], `${path}/${pointerEscape(key)}`));
  return changes;
}

function toPatchState(state) {
  const notesById = Object.fromEntries((state.notes || []).map(note => [String(note.id), clone(note)]));
  return { notesById, subjectMeta: clone(state.subjectMeta || {}) };
}
function fromPatchState(state) {
  const notes = Object.values(state.notesById || {}).map(note => {
    const next = clone(note);
    if (!Array.isArray(next.assets)) {
      if (next.assets && typeof next.assets === 'object') {
        next.assets = Object.values(next.assets).filter(asset => asset && typeof asset === 'object');
      } else {
        next.assets = [];
      }
    }
    next.assets = next.assets.filter(asset => asset && typeof asset === 'object').map((asset, index) => ({
      id: String(asset.id || `asset_legacy_${index}`),
      type: ['image', 'vector', 'diagram', 'graph'].includes(asset.type) ? asset.type : 'image',
      source: ['url', 'ai', 'custom'].includes(asset.source) ? asset.source : 'custom',
      url: typeof asset.url === 'string' ? asset.url : '',
      title: String(asset.title || ''),
      caption: String(asset.caption || ''),
      prompt: String(asset.prompt || ''),
      data: asset.data && typeof asset.data === 'object' ? asset.data : null,
      target: asset.target && typeof asset.target === 'object' ? { type: String(asset.target.type || 'note'), key: String(asset.target.key || 'note') } : { type: 'note', key: 'note' }
    }));
    return next;
  });
  return { notes, subjectMeta: clone(state.subjectMeta || {}) };
}

function normalizeLibrary(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid library file.');
  if (raw.schemaVersion !== SCHEMA_VERSION || !Array.isArray(raw.patches)) throw new Error('Unsupported library schema.');
  return { schemaVersion: SCHEMA_VERSION, libraryId: raw.libraryId || makeId('library'), headPatchId: raw.headPatchId || raw.patches.at(-1)?.id || null,
    patches: raw.patches.map(patch => ({ id: patch.id, parentId: patch.parentId ?? null, timestamp: patch.timestamp, kind: patch.kind || 'change', changes: Array.isArray(patch.changes) ? patch.changes : [] })) };
}

export function createOriginLibrary(notes, subjectMeta = {}) {
  const patch = { id: makeId(), parentId: null, timestamp: new Date().toISOString(), kind: 'origin', changes: [{ op: 'add', path: '', value: toPatchState({ notes, subjectMeta }) }] };
  return { schemaVersion: SCHEMA_VERSION, libraryId: makeId('library'), headPatchId: patch.id, patches: [patch] };
}

export function materializeLibrary(rawLibrary, stopAtPatchId = null) {
  const library = normalizeLibrary(rawLibrary);
  let patchState = { notesById: {}, subjectMeta: {} };
  for (const patch of library.patches) {
    patchState = applyChanges(patchState, patch.changes);
    if (stopAtPatchId && patch.id === stopAtPatchId) break;
  }
  return fromPatchState(patchState);
}

export function appendRawPatch(rawLibrary, changes, kind = 'change') {
  const library = normalizeLibrary(rawLibrary);
  if (!Array.isArray(changes) || !changes.length) throw new Error('Patch must contain at least one change.');

  // Validate the operations against the current materialized state before recording them.
  const current = materializeLibrary(library);
  const patchState = {
    notesById: Object.fromEntries(current.notes.map(note => [String(note.id), clone(note)])),
    subjectMeta: clone(current.subjectMeta || {})
  };
  applyChanges(patchState, changes);

  const patch = {
    id: makeId(),
    parentId: library.headPatchId,
    timestamp: new Date().toISOString(),
    kind,
    changes: clone(changes)
  };
  return {
    library: { ...library, headPatchId: patch.id, patches: [...library.patches, patch] },
    patch
  };
}

export function appendPatch(rawLibrary, beforeState, afterState, kind = 'change') {
  const library = normalizeLibrary(rawLibrary);
  const changes = diffValues(toPatchState(beforeState), toPatchState(afterState));
  if (!changes.length) return { library, patch: null };
  const patch = { id: makeId(), parentId: library.headPatchId, timestamp: new Date().toISOString(), kind, changes };
  return { library: { ...library, headPatchId: patch.id, patches: [...library.patches, patch] }, patch };
}

export function appendRevertPatch(rawLibrary, currentState, targetState, kind = 'rollback') { return appendPatch(rawLibrary, currentState, targetState, kind); }
export function getPatchIndex(library, patchId) { return library.patches.findIndex(patch => patch.id === patchId); }
export function getPatchesAfter(library, patchId) { const index = getPatchIndex(library, patchId); return index < 0 ? null : library.patches.slice(index + 1); }

export function compactPatchesSince(library, patchId) {
  return compactPatchesBetween(library, patchId, library.headPatchId);
}

export function compactPatchesBetween(rawLibrary, startPatchId, endPatchId = null) {
  const library = normalizeLibrary(rawLibrary);
  const startIndex = getPatchIndex(library, startPatchId);
  const endId = endPatchId || library.headPatchId;
  const endIndex = getPatchIndex(library, endId);
  if (startIndex < 0) throw new Error('Start patch ID is not present in this library chain.');
  if (endIndex < 0) throw new Error('End patch ID is not present in this library chain.');
  if (endIndex < startIndex) throw new Error('End patch must come after the start patch.');
  const base = materializeLibrary(library, startPatchId);
  const head = materializeLibrary(library, endId);
  return {
    schemaVersion: SCHEMA_VERSION,
    type: 'patch-bundle',
    id: makeId('patch'),
    parentId: startPatchId,
    kind: 'sync_bundle',
    libraryId: library.libraryId,
    basePatchId: startPatchId,
    headPatchId: endId,
    patchCount: endIndex - startIndex,
    timestamp: new Date().toISOString(),
    changes: diffValues(toPatchState(base), toPatchState(head))
  };
}
export function exportLibrary(rawLibrary) { return clone(normalizeLibrary(rawLibrary)); }
export function importLibrary(raw) { return normalizeLibrary(raw); }

export function patchStateForLibrary(library) {
  const state = materializeLibrary(library);
  return { notesById: Object.fromEntries(state.notes.map(note => [String(note.id), clone(note)])), subjectMeta: clone(state.subjectMeta || {}) };
}
