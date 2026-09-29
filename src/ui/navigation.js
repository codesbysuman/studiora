import { VIEWS } from '../config.js';
import { findNote } from '../services/notes.js';

function encode(value) { return encodeURIComponent(String(value)); }
function decode(value) { try { return decodeURIComponent(value); } catch (_) { return value; } }

export function createNavigation(store) {
  let syncing = false;
  const initialHash = location.hash || '#/subjects';
  history.replaceState({ contextNotes: true, route: initialHash }, '', initialHash);

  const pushRoute = hash => {
    if (location.hash === hash) return;
    history.pushState({ contextNotes: true, route: hash }, '', hash);
  };
  const applyHash = () => {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decode);
    const state = store.getState();
    if (!parts.length || parts[0] === 'subjects') return api.subjects(false);
    if (parts[0] === 'online-library') return api.library('online', false);
    if (parts[0] === 'search') return api.search(false);
    if (parts[0] === 'subject' && parts[1] && !parts[2]) return api.chapters(parts[1], false);
    if (parts[0] === 'subject' && parts[1] && parts[2] === 'chapter' && parts[3]) return api.notes(parts[1], parts[3], false);
    if (parts[0] === 'note' && parts[1]) { const note = findNote(state.notes, parts[1]); if (note) return api.reader(note, false); }
    return api.subjects(false);
  };
  const api = {
    subjects(updateHash = true) { store.setState({ currentView: VIEWS.SUBJECTS, activeSubject: null, activeChapter: null, activeNoteId: null, searchQuery: '', searchFilter: 'all', sortBy: 'title', libraryTab: 'my' }); if (updateHash) pushRoute('#/subjects'); },
    library(tab = 'my', updateHash = true) { const online = tab === 'online'; store.setState({ currentView: VIEWS.SUBJECTS, activeSubject: null, activeChapter: null, activeNoteId: null, searchQuery: '', searchFilter: 'all', sortBy: 'title', libraryTab: online ? 'online' : 'my' }); if (updateHash) pushRoute(online ? '#/online-library' : '#/subjects'); },
    chapters(subject, updateHash = true) { store.setState({ currentView: VIEWS.CHAPTERS, activeSubject: subject, activeChapter: null, activeNoteId: null, searchQuery: '', searchFilter: 'all', sortBy: 'title', libraryTab: 'my' }); if (updateHash) pushRoute(`#/subject/${encode(subject)}`); },
    notes(subject, chapter, updateHash = true) { store.setState({ currentView: VIEWS.NOTES, activeSubject: subject, activeChapter: chapter, activeNoteId: null, searchQuery: '', searchFilter: 'all', sortBy: 'title', libraryTab: 'my' }); if (updateHash) pushRoute(`#/subject/${encode(subject)}/chapter/${encode(chapter)}`); },
    reader(note, updateHash = true) { if (!note) return; store.setState({ currentView: VIEWS.READER, activeSubject: note.subject, activeChapter: note.chapter, activeNoteId: note.id, searchQuery: '', searchFilter: 'all', sortBy: 'title', libraryTab: 'my' }); if (updateHash) pushRoute(`#/note/${encode(note.id)}`); },
    search(updateHash = true) { store.setState({ currentView: VIEWS.SEARCH, activeNoteId: null, sortBy: 'relevance' }); if (updateHash) pushRoute('#/search'); },
    back() {
      const current = location.hash || '#/subjects';
      if (history.state?.contextNotes && current !== initialHash) { history.back(); return; }
      const state = store.getState();
      if (state.currentView === VIEWS.READER) api.notes(state.activeSubject, state.activeChapter);
      else if (state.currentView === VIEWS.NOTES) api.chapters(state.activeSubject);
      else if (state.currentView === VIEWS.CHAPTERS) api.subjects();
      else api.subjects();
    },
    syncFromHash() { if (syncing) return; applyHash(); }
  };
  window.addEventListener('popstate', () => applyHash());
  window.addEventListener('hashchange', () => { if (!history.state?.contextNotes) applyHash(); });
  applyHash();
  return api;
}
