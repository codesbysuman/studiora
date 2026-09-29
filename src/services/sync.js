import { compactPatchesSince } from './library.js';

// Cloud sync will call this with the patch ID the server already has.
// The result is one compact patch representing everything after that point.
export function buildSyncPatch(library, cloudPatchId) {
  return compactPatchesSince(library, cloudPatchId);
}
