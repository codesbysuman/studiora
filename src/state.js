import { VIEWS } from './config.js';
import { appendPatch, appendRawPatch, importLibrary, materializeLibrary } from './services/library.js';
import { loadLibrary, saveLibrary } from './services/storage.js';
import { compileBodyWithTerms } from './services/terms.js';

export function createStore() {
  let library = loadLibrary();
  let materialized = materializeLibrary(library);
  let state = {
    library, notes: materialized.notes, subjectMeta: materialized.subjectMeta,
    currentView: VIEWS.SUBJECTS, activeSubject: null, activeChapter: null, activeNoteId: null,
    searchQuery: '', sortBy: 'relevance', searchFilter: 'all', libraryTab: 'my', hideAnswers: true, pendingIncomingNote: null
  };
  const listeners = new Set();
  const notify = () => listeners.forEach(listener => listener(state));
  const refresh = nextLibrary => {
    library = nextLibrary;
    materialized = materializeLibrary(library);
    state = { ...state, library, notes: materialized.notes, subjectMeta: materialized.subjectMeta };
    saveLibrary(library); notify();
  };
  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    setState(patch) { state = { ...state, ...patch }; notify(); },
    updateLibrary(nextLibrary) { refresh(importLibrary(nextLibrary)); },
    updateContent(after, kind = 'change') {
      const before = { notes: state.notes, subjectMeta: state.subjectMeta };
      const result = appendPatch(library, before, after, kind);
      if (result.patch) refresh(result.library);
      return result.patch;
    },
    replaceWithNotes(notes, subjectMeta = state.subjectMeta, kind = 'change') {
      return this.updateContent({ notes, subjectMeta }, kind);
    },
    replaceFromPatch(patchId, kind = 'rollback') {
      const target = materializeLibrary(library, patchId);
      return this.updateContent(target, kind);
    },
    applyPatchChanges(changes, kind = 'ai_patch') {
      const result = appendRawPatch(library, changes, kind);
      refresh(result.library);
      return result.patch;
    }
  };
}
