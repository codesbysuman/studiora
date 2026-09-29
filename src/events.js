import { findNote } from './services/notes.js';
import { hide, show } from './ui/dom.js';

export function bindEvents(dom, store, navigation, modals) {
  dom['global-search'].addEventListener('input', event => {
    const query = event.target.value.trim().toLowerCase();
    store.setState({ searchQuery: query });
    if (store.getState().libraryTab === 'online') return;
    if (query) navigation.search();
    else navigation.subjects();
  });
  dom['btn-search-clear']?.addEventListener('click', () => {
    dom['global-search'].value = '';
    store.setState({ searchQuery: '' });
    navigation.subjects();
    dom['global-search'].focus();
  });
  dom['btn-back'].addEventListener('click', () => navigation.back());
  const toggleSearchMenu = (menu, other, button) => {
    if (!menu) return;
    const opening = menu.classList.contains('hidden');
    other?.classList.add('hidden');
    menu.classList.toggle('hidden', !opening);
    button?.setAttribute('aria-expanded', String(opening));
  };
  dom['btn-sort-menu']?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); toggleSearchMenu(dom['sort-menu'], dom['filter-menu'], dom['btn-sort-menu']); });
  dom['btn-filter-menu']?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); toggleSearchMenu(dom['filter-menu'], dom['sort-menu'], dom['btn-filter-menu']); });
  dom['sort-menu']?.addEventListener('click', event => { const sort = event.target.closest('[data-sort]'); if (sort) { store.setState({ sortBy: sort.dataset.sort }); dom['sort-menu'].classList.add('hidden'); } });
  dom['filter-menu']?.addEventListener('click', event => { const filter = event.target.closest('[data-filter]'); if (filter) { store.setState({ searchFilter: filter.dataset.filter }); dom['filter-menu'].classList.add('hidden'); } });
  document.addEventListener('click', event => { if (!event.target.closest('.search-tool-wrap')) { dom['sort-menu']?.classList.add('hidden'); dom['filter-menu']?.classList.add('hidden'); } if (!event.target.closest('.header-right')) { dom['header-more-menu']?.classList.add('hidden'); dom['btn-header-more']?.setAttribute('aria-expanded', 'false'); } });
  dom['btn-toggle-answers'].addEventListener('click', () => store.setState({ hideAnswers: !store.getState().hideAnswers }));
  dom['btn-header-more']?.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); const menu = dom['header-more-menu']; const opening = menu?.classList.contains('hidden'); menu?.classList.toggle('hidden', !opening); dom['btn-header-more']?.setAttribute('aria-expanded', String(opening)); });
  dom['header-more-menu']?.addEventListener('click', event => { const action = event.target.closest('[data-header-action]')?.dataset.headerAction; if (!action) return; dom['header-more-menu'].classList.add('hidden'); if (action === 'backup') dom['btn-backup-open']?.click(); if (action === 'history') dom['btn-history-open']?.click(); });

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    if (target.matches('[data-clear-sort]')) { store.setState({ sortBy: stateDefaultSort(store.getState()) }); return; }
    if (target.matches('[data-clear-filter]')) { store.setState({ searchFilter: 'all' }); return; }
    const action = target.dataset.action;
    const state = store.getState();

    if (action === 'open-subject') navigation.chapters(target.dataset.subject);
    else if (action === 'library-tab') {
      event.preventDefault();
      dom['global-search'].value = '';
      navigation.library(target.dataset.libraryTab === 'online' ? 'online' : 'my');
    }
    else if (action === 'library-sync') {
      event.preventDefault();
      showToast('Sync is coming soon.');
    }

    else if (action === 'attach-note-asset') openAssetEditor(dom, store, target.dataset.targetType, target.dataset.targetKey);
    else if (action === 'open-chapter') navigation.notes(state.activeSubject, target.dataset.chapter);
    else if (action === 'open-note' || action === 'open-search-note') navigation.reader(findNote(state.notes, target.dataset.noteId));
    else if (action === 'toggle-qa') { const answer = document.getElementById(target.dataset.qaId); answer?.classList.toggle('hidden-answer'); target.classList.toggle('open', !answer?.classList.contains('hidden-answer')); const icon = target.querySelector('.qa-chevron'); if (icon) icon.textContent = answer?.classList.contains('hidden-answer') ? 'expand_more' : 'expand_less'; }
    else if (action === 'edit-note') modals.openEditNote(target.dataset.noteId);
    else if (action === 'delete-note') {
      if (!confirm('Permanently delete this note?')) return;
      const id = Number(target.dataset.noteId);
      store.replaceWithNotes(state.notes.filter(note => Number(note.id) !== id), state.subjectMeta, 'delete');
      navigation.notes(state.activeSubject, state.activeChapter);
    } else if (action === 'mcq') {
      const container = target.parentElement;
      container.querySelectorAll('.mcq-opt').forEach(button => {
        button.classList.remove('correct', 'incorrect');
        if (Number(button.dataset.correct) === Number(button.dataset.selected)) button.classList.add('correct');
      });
      if (Number(target.dataset.selected) !== Number(target.dataset.correct)) target.classList.add('incorrect');
    }
  });

  document.addEventListener('click', event => {
    const term = event.target.closest('mark.term');
    if (!term) return;
    event.stopPropagation();
    const name = term.textContent;
    const def = term.dataset.def || 'No definition attached.';
    const note = term.dataset.note || '';
    dom['term-title'].textContent = name;
    dom['term-def'].textContent = def;
    dom['term-note'].textContent = note;
    dom['term-note-block'].style.display = note ? 'block' : 'none';
    dom['btn-speak-term'].onclick = () => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`${name}. Definition: ${def}. ${note}`);
      utterance.rate = 0.95; window.speechSynthesis.speak(utterance);
    };
    show(dom['term-sheet']);
  });

  dom['btn-close-term'].addEventListener('click', () => { hide(dom['term-sheet']); window.speechSynthesis?.cancel?.(); });
}

function openAssetEditor(dom, store, targetType, targetKey) {
  const state=store.getState(); const note=state.notes.find(n=>Number(n.id)===Number(state.activeNoteId)); if(!note) return;
  dom['asset-target-type'].value=targetType; dom['asset-target-key'].value=targetKey; dom['asset-target-label'].textContent=`Attach to: ${targetType.replaceAll('-', ' ')} · ${targetKey}`;
  dom['asset-form'].dataset.noteId=note.id; dom['asset-form'].reset(); dom['asset-target-type'].value=targetType; dom['asset-target-key'].value=targetKey;
  show(dom['asset-modal']);
}

export function bindAssetForm(dom, store) {
  dom['btn-close-asset']?.addEventListener('click', ()=>hide(dom['asset-modal']));
  dom['asset-form']?.addEventListener('submit', event=>{
    event.preventDefault(); const state=store.getState(); const note=state.notes.find(n=>Number(n.id)===Number(dom['asset-form'].dataset.noteId)); if(!note) return;
    const type=dom['asset-type'].value; const source=dom['asset-source'].value; const url=dom['asset-url'].value.trim();
    if (source === 'url' && !/^https?:\/\//i.test(url)) { alert('A valid http(s) resource URL is required for a sourced visual.'); return; }
    const asset={id:`asset_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2,7)}`}`,type,source,url,title:dom['asset-title'].value.trim(),caption:dom['asset-caption'].value.trim(),prompt:dom['asset-prompt'].value.trim(),target:{type:dom['asset-target-type'].value,key:dom['asset-target-key'].value}};
    const next=state.notes.map(n=>Number(n.id)===Number(note.id)?{...n,assets:[...(n.assets||[]),asset]}:n); store.replaceWithNotes(next,state.subjectMeta,'attach_asset'); hide(dom['asset-modal']);
  });
}

function stateDefaultSort(state) { return state.currentView === 'search' ? 'relevance' : 'title'; }

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 2800);
}
