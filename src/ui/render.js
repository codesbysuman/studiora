import { VIEWS } from '../config.js';
import { escapeHtml } from '../utils/html.js';
import { hide, show } from './dom.js';
import { findNote } from '../services/notes.js';
import { searchLibrary } from '../services/search.js';

export function renderApp(state, dom) {
  [dom['view-subjects'], dom['view-chapters'], dom['view-notes-list'], dom['view-note-reader'], dom['view-search']].forEach(hide);
  if (state.currentView === VIEWS.SEARCH || state.searchQuery) renderSearch(state, dom);
  else if (state.currentView === VIEWS.SUBJECTS) renderSubjects(state, dom);
  else if (state.currentView === VIEWS.CHAPTERS) renderChapters(state, dom);
  else if (state.currentView === VIEWS.NOTES) renderNotes(state, dom);
  else if (state.currentView === VIEWS.READER) renderReader(state, dom);
  updateHeader(state, dom);
  renderSearchControls(state, dom);
  dom['btn-search-clear']?.classList.toggle('hidden', !state.searchQuery);
}

function updateHeader(state, dom) {
  const note = findNote(state.notes, state.activeNoteId);
  const online = state.libraryTab === 'online' && state.currentView === VIEWS.SUBJECTS;
  const title = online ? 'Online Library' : state.currentView === VIEWS.SEARCH ? 'Search Library' : state.currentView === VIEWS.SUBJECTS ? 'My Library' : state.currentView === VIEWS.CHAPTERS ? state.activeSubject : state.currentView === VIEWS.NOTES ? state.activeChapter : (note?.title || 'Note');
  const path = online ? 'Discover study resources from the online collection' : state.currentView === VIEWS.SEARCH ? 'Search across your notes and study material' : state.currentView === VIEWS.SUBJECTS ? 'Your notes and saved study material' : state.currentView === VIEWS.CHAPTERS ? subjectMetaText(state.subjectMeta?.[state.activeSubject]) : `${state.activeSubject} / ${state.activeChapter}`;
  dom['app-heading'].textContent = title;
  dom['app-heading'].title = title;
  dom['breadcrumb-subtext'].textContent = path;
  dom['breadcrumb-subtext'].title = path;
  state.currentView === VIEWS.SUBJECTS || state.currentView === VIEWS.SEARCH ? hide(dom['btn-back']) : show(dom['btn-back']);
  const reader = state.currentView === VIEWS.READER;
  dom['btn-toggle-answers']?.classList.toggle('hidden', !reader);
  if (reader) dom['btn-toggle-answers'].setAttribute('aria-pressed', String(!state.hideAnswers));
  dom['answers-toggle-icon'].textContent = state.hideAnswers ? 'visibility' : 'visibility_off';
}
function renderSearchControls(state, dom) {
  const sortMenu = dom['sort-menu'];
  const filterMenu = dom['filter-menu'];
  if (!sortMenu || !filterMenu) return;
  let sortOptions = [];
  let filterOptions = [];
  if (state.libraryTab === 'online' && state.currentView === VIEWS.SUBJECTS) {
    sortOptions = []; filterOptions = [];
  } else if (state.currentView === VIEWS.SUBJECTS) {
    sortOptions = [['title', 'Name'], ['count', 'Most Notes']];
    filterOptions = [['all', 'All Categories'], ['school', 'School'], ['higher', 'Higher Education'], ['competitive', 'Competitive / Exam'], ['general', 'General'], ['downloads', 'Downloads']];
  } else if (state.currentView === VIEWS.CHAPTERS) {
    sortOptions = [['chapter-number', 'Chapter Number'], ['title', 'Title'], ['count', 'Most Notes']];
    filterOptions = [['all', 'All Chapters']];
  } else if (state.currentView === VIEWS.NOTES) {
    sortOptions = [['title', 'Title'], ['label', 'Label'], ['newest', 'Newest'], ['oldest', 'Oldest']];
    filterOptions = [['all', 'Everything'], ['notes', 'Notes'], ['pyq', 'PYQ'], ['questions', 'Questions']];
  } else if (state.currentView === VIEWS.SEARCH) {
    sortOptions = [['relevance', 'Relevance'], ['title', 'Title'], ['label', 'Label'], ['newest', 'Newest'], ['oldest', 'Oldest']];
    filterOptions = [['all', 'Everything'], ['notes', 'Notes'], ['pyq', 'PYQ'], ['questions', 'Questions']];
  }
  sortMenu.innerHTML = sortOptions.length ? `<div class="search-menu-section"><strong>Sort by</strong>${sortOptions.map(([value, label]) => `<button type="button" data-sort="${value}" class="${state.sortBy === value ? 'selected' : ''}">${label}</button>`).join('')}</div>` : '';
  filterMenu.innerHTML = filterOptions.length ? `<div class="search-menu-section"><strong>Show</strong>${filterOptions.map(([value, label]) => `<button type="button" data-filter="${value}" class="${state.searchFilter === value ? 'selected' : ''}">${label}</button>`).join('')}</div>` : '';
  dom['btn-sort-menu']?.classList.toggle('hidden', !sortOptions.length);
  dom['btn-filter-menu']?.classList.toggle('hidden', !filterOptions.length);
  renderActiveSearchChips(state, dom, sortOptions, filterOptions);
  const input = dom['global-search'];
  if (input) {
    input.disabled = state.libraryTab === 'online' && state.currentView === VIEWS.SUBJECTS;
    input.placeholder = input.disabled ? 'Online search is coming soon' : state.currentView === VIEWS.SEARCH ? 'Search your library...' : 'Search your library...';
  }
}

function renderActiveSearchChips(state, dom, sortOptions, filterOptions) {
  const container = dom['active-search-chips'];
  if (!container) return;
  const chips = [];
  const defaultSort = state.currentView === VIEWS.SEARCH ? 'relevance' : 'title';
  if (state.sortBy !== defaultSort && sortOptions.some(([value]) => value === state.sortBy)) {
    const label = sortOptions.find(([value]) => value === state.sortBy)?.[1] || state.sortBy;
    chips.push(`<button class="active-search-chip" type="button" data-action="clear-sort" data-clear-sort><span class="material-symbols-outlined">sort</span>${escapeHtml(label)}<span class="material-symbols-outlined chip-close">close</span></button>`);
  }
  if (state.searchFilter !== 'all' && filterOptions.some(([value]) => value === state.searchFilter)) {
    const label = filterOptions.find(([value]) => value === state.searchFilter)?.[1] || state.searchFilter;
    chips.push(`<button class="active-search-chip" type="button" data-action="clear-filter" data-clear-filter><span class="material-symbols-outlined">filter_list</span>${escapeHtml(label)}<span class="material-symbols-outlined chip-close">close</span></button>`);
  }
  container.innerHTML = chips.join('');
}
function renderSubjects(state, dom) {
  if (state.libraryTab === 'online') {
    dom['view-subjects'].innerHTML = `<div class="library-shell"><div class="library-tabs" role="tablist" aria-label="Library source"><button id="btn-library-tab-my" class="library-tab" type="button" data-action="library-tab" data-library-tab="my">My Library</button><button id="btn-library-tab-online" class="library-tab active" type="button" data-action="library-tab" data-library-tab="online">Online Library</button></div><div class="coming-soon-card"><span class="material-symbols-outlined">cloud_queue</span><h2>Online Library</h2><p>Coming Soon</p><span>Curated study resources and shared collections will appear here when Online Library launches.</span></div></div>`;
    show(dom['view-subjects']);
    return;
  }

  const map = {};
  state.notes.forEach(note => {
    map[note.subject] ||= { chapters: new Set(), count: 0 };
    map[note.subject].chapters.add(note.chapter);
    map[note.subject].count++;
  });
  const subjects = Object.keys(map).sort((a, b) => sortSubjects(a, b, map, state.sortBy));
  const filteredSubjects = state.searchFilter === 'downloads' ? [] : subjects.filter(subject => {
    if (state.searchFilter === 'all') return true;
    return categoryKey(subjectCategory(state.subjectMeta?.[subject])) === state.searchFilter;
  });
  const groups = {};
  filteredSubjects.forEach(subject => {
    const category = subjectCategory(state.subjectMeta?.[subject]);
    (groups[category] ||= []).push(subject);
  });

  const categories = ['School', 'Higher Education', 'Competitive / Exam', 'General'];
  const groupHtml = categories.filter(category => groups[category]?.length).map(category => `<section class="subject-group"><div class="section-label">${escapeHtml(category)}</div><div class="subjects-grid">${groups[category].map(subject => renderSubjectCard(subject, map[subject], state.subjectMeta?.[subject])).join('')}</div></section>`).join('');
  const downloadSection = `<section class="download-category"><div class="section-label">Downloads</div><div class="library-empty-card"><span class="material-symbols-outlined">download</span><div><strong>No downloaded resources</strong><p>Online Library downloads will be organized here in a future phase.</p></div></div></section>`;
  const emptyMessage = state.searchFilter === 'downloads' ? downloadSection : empty('No subjects found in this category.');

  dom['view-subjects'].innerHTML = `<div class="library-shell"><div class="library-tabs" role="tablist" aria-label="Library source"><button id="btn-library-tab-my" class="library-tab active" type="button" data-action="library-tab" data-library-tab="my">My Library</button><button id="btn-library-tab-online" class="library-tab" type="button" data-action="library-tab" data-library-tab="online">Online Library</button><button id="btn-library-sync" class="library-sync-btn" type="button" data-action="library-sync" aria-label="Sync library" title="Sync library"><span class="material-symbols-outlined">sync</span>Sync</button></div><div class="library-toolbar-note"><span class="material-symbols-outlined">offline_bolt</span><span>Your notes stay on this device and are ready whenever you open Studiora.</span></div>${groupHtml || emptyMessage}${state.searchFilter === 'downloads' ? '' : downloadSection}</div>`;
  show(dom['view-subjects']);
}

function renderSubjectCard(subject, info, meta = {}) {
  return `<div class="subject-card" data-action="open-subject" data-subject="${escapeHtml(subject)}">
    <div class="subject-card-main"><div class="icon-tag"><span class="material-symbols-outlined">folder</span></div><div class="subject-title-row"><h3>${escapeHtml(subject)}</h3>${meta.level ? `<span class="subject-level">${escapeHtml(meta.level)}</span>` : ''}</div></div>
    <div class="subject-card-meta">${meta.medium ? `<span class="meta-chip">${escapeHtml(meta.medium)}</span>` : ''}${meta.board ? `<span class="meta-chip">${escapeHtml(meta.board)}</span>` : ''}<span class="subject-count">${info.chapters.size} Ch · ${info.count} Notes</span></div>
  </div>`;
}

function sortSubjects(a, b, map, sortBy) {
  if (sortBy === 'count') return map[b].count - map[a].count || a.localeCompare(b);
  return a.localeCompare(b);
}

function renderChapters(state, dom) {
  const map = {};
  state.notes.filter(n => n.subject === state.activeSubject).forEach(n => {
    const key = n.chapter;
    map[key] ||= { count: 0, number: n.chapterNumber ?? null };
    map[key].count++;
    if (map[key].number == null && n.chapterNumber != null) map[key].number = n.chapterNumber;
  });
  const chapters = Object.entries(map).sort((a, b) => {
    const [, left] = a; const [, right] = b;
    if (state.sortBy === 'count') return right.count - left.count || a[0].localeCompare(b[0]);
    if (state.sortBy === 'title') return a[0].localeCompare(b[0]);
    if (left.number != null && right.number != null) return left.number - right.number;
    if (left.number != null) return -1;
    if (right.number != null) return 1;
    return a[0].localeCompare(b[0]);
  });
  const meta = state.subjectMeta?.[state.activeSubject] || {};
  dom['view-chapters'].innerHTML = `<div class="subject-detail-card"><div class="subject-detail-title"><strong>${escapeHtml(state.activeSubject)}</strong>${meta.level ? `<span class="subject-level">${escapeHtml(meta.level)}</span>` : ''}</div><div class="subject-detail-chips">${meta.medium ? `<span class="meta-chip">${escapeHtml(meta.medium)}</span>` : ''}${meta.board ? `<span class="meta-chip">${escapeHtml(meta.board)}</span>` : ''}</div></div>` + (chapters.length ? chapters.map(([chapter, info]) => `<div class="chapter-card" data-action="open-chapter" data-chapter="${escapeHtml(chapter)}"><div class="chapter-number">${info.number ?? '—'}</div><div class="chapter-info"><h3>${escapeHtml(chapter)}</h3><span>${info.count} ${info.count === 1 ? 'Topic' : 'Topics'} Available</span></div><span class="material-symbols-outlined chapter-arrow">chevron_right</span></div>`).join('') : empty('No chapters in this subject.'));
  show(dom['view-chapters']);
}

function renderNotes(state, dom) {
  const filtered = filterNotes(state.notes.filter(n => n.subject === state.activeSubject && n.chapter === state.activeChapter), state.searchFilter);
  filtered.sort((a, b) => sortNotes(a, b, state.sortBy));
  dom['view-notes-list'].innerHTML = filtered.length ? filtered.map(note => {
    const cleanBody = stripHtml(note.body || '');
    return `<div class="note-item-card" data-action="open-note" data-note-id="${note.id}"><div class="note-item-header"><h3 class="note-item-title">${escapeHtml(note.title)}</h3><span class="material-symbols-outlined" style="color:var(--text-muted);font-size:18px">arrow_forward</span></div><p class="note-peek-text">${escapeHtml(cleanBody)}</p><div class="note-meta-badges"><span class="meta-badge label-badge">${escapeHtml(note.label || 'Notes')}</span>${note.qas?.length ? `<span class="meta-badge"><span class="material-symbols-outlined">help</span>${note.qas.length} Q&A</span>` : ''}${note.mcqs?.length ? `<span class="meta-badge"><span class="material-symbols-outlined">quiz</span>${note.mcqs.length} MCQ</span>` : ''}</div></div>`;
  }).join('') : empty('No notes match the current filter.');
  show(dom['view-notes-list']);
}

function renderSearch(state, dom) {
  const filteredNotes = filterNotes(state.notes, state.searchFilter);
  const results = searchLibrary(filteredNotes, state.subjectMeta, state.searchQuery);
  if (state.sortBy !== 'relevance') results.sort((a, b) => sortNotes(a.note, b.note, state.sortBy));
  dom['view-search'].innerHTML = state.searchQuery ? (results.length ? `<div class="search-summary">${results.length} result${results.length === 1 ? '' : 's'} across your library</div>${results.map(result => {
    const note = result.note;
    return `<div class="search-result-card" data-action="open-search-note" data-note-id="${note.id}"><div class="search-result-top"><span class="meta-badge label-badge">${escapeHtml(note.label || 'Notes')}</span><strong>${escapeHtml(note.title)}</strong><span class="search-score">${result.score}</span></div><div class="search-path">${escapeHtml(note.subject)} · Ch. ${note.chapterNumber ?? '—'} · ${escapeHtml(note.chapter)}</div><p>${escapeHtml(searchSnippet(note, state.searchQuery))}</p><div class="search-matches">${result.matched.slice(0, 4).map(field => `<span class="meta-chip">${escapeHtml(fieldLabel(field))}</span>`).join('')}</div></div>`;
  }).join('')}` : empty('No matches found anywhere in the library.')) : `<div class="search-empty-state"><span class="material-symbols-outlined">search</span><strong>Search your whole library</strong><span>Subjects, chapters, note titles, content, terms, Q&A, MCQs and metadata.</span></div>`;
  show(dom['view-search']);
}

function filterNotes(notes, filter) {
  if (filter === 'pyq') return notes.filter(note => (note.label || 'Notes').toLowerCase().includes('pyq'));
  if (filter === 'questions') return notes.filter(note => (note.qas?.length || 0) > 0 || (note.mcqs?.length || 0) > 0);
  if (filter === 'notes') return notes.filter(note => !(note.label || 'Notes').toLowerCase().includes('pyq'));
  return notes;
}

function sortNotes(a, b, sortBy = 'title') {
  if (sortBy === 'newest') return noteTime(b) - noteTime(a) || String(b.id).localeCompare(String(a.id));
  if (sortBy === 'oldest') return noteTime(a) - noteTime(b) || String(a.id).localeCompare(String(b.id));
  if (sortBy === 'label') return (a.label || 'Notes').localeCompare(b.label || 'Notes') || a.title.localeCompare(b.title);
  return a.title.localeCompare(b.title);
}

function noteTime(note) {
  return Date.parse(note.createdAt || '') || Number(note.id) || 0;
}

function searchSnippet(note, query) {
  const text = stripHtml(note.body || '');
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = text.toLowerCase();
  const indexes = terms.map(term => lower.indexOf(term)).filter(index => index >= 0);
  const index = Math.max(0, indexes.sort((a, b) => a - b)[0] ?? 0);
  const start = Math.max(0, index - 55);
  return `${start ? '…' : ''}${text.slice(start, start + 180)}${text.length > start + 180 ? '…' : ''}`;
}

function fieldLabel(field) {
  return ({ subject: 'Subject', chapter: 'Chapter', title: 'Title', label: 'Label', body: 'Content', terms: 'Terms', questions: 'Q&A', mcq: 'MCQ', board: 'Board', medium: 'Medium', level: 'Class / Level' })[field] || field;
}

function subjectCategory(meta = {}) {
  const text = `${meta.level || ''} ${meta.board || ''}`.toLowerCase();
  if (/upsc|ssc|competitive|entrance|exam|pyq/.test(text)) return 'Competitive / Exam';
  if (/class\s*(1|2|3|4|5|6|7|8|9|10|11|12)|school|cbse|icse|ahsec|hs/.test(text)) return 'School';
  if (/ba|bsc|bca|bcom|semester|university|college|undergraduate|postgraduate|ma|msc/.test(text)) return 'Higher Education';
  return 'General';
}

function categoryKey(category) {
  return ({ School: 'school', 'Higher Education': 'higher', 'Competitive / Exam': 'competitive', General: 'general' })[category] || 'general';
}

function subjectMetaText(meta = {}) { return [meta.board, meta.medium, meta.level].filter(Boolean).join(' · '); }
function stripHtml(value = '') { return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
function empty(message) { return `<p style="text-align:center;padding:40px;color:var(--text-muted)">${escapeHtml(message)}</p>`; }

function renderReader(state, dom) {
  const note = findNote(state.notes, state.activeNoteId);
  if (!note) return;
  let body = note.body || '';
  if (!/<(p|div|br|ul|ol|li|h3|h4|table|blockquote)\b[^>]*>/i.test(body)) body = body.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
  body = injectParagraphTargets(body, note.assets);

  const qas = (note.qas || []).map((qa, i) => {
    const qKey = `qa-question-${i}`;
    const aKey = `qa-answer-${i}`;
    const questionAssets = renderTargetAssets(note, 'qa-question', qKey);
    const answerAssets = renderTargetAssets(note, 'qa-answer', aKey);
    return `<div class="qa-card"><div class="qa-question" data-action="toggle-qa" data-qa-id="${note.id}-qa-${i}"><span>${escapeHtml(qa.question)}</span><span class="material-symbols-outlined qa-chevron">expand_more</span></div>${questionAssets}<div id="${note.id}-qa-${i}" class="qa-answer ${state.hideAnswers ? 'hidden-answer' : ''}">${escapeHtml(qa.answer)}${answerAssets}</div></div>`;
  }).join('');

  const mcqs = (note.mcqs || []).map((mcq, i) => {
    const key = `mcq-question-${i}`;
    return `<div class="mcq-card"><div class="mcq-question">${escapeHtml(mcq.question)}</div>${renderTargetAssets(note, 'mcq-question', key)}<div class="mcq-options">${(mcq.options || []).map((option, index) => `<button class="mcq-opt" data-action="mcq" data-selected="${index}" data-correct="${mcq.answerIndex}">${escapeHtml(option)}</button>`).join('')}</div></div>`;
  }).join('');

  const noteAssets = renderTargetAssets(note, 'note', 'note');
  dom['view-note-reader'].innerHTML = `<div class="reader-card"><div class="reader-header"><div class="reader-tags"><span class="tag-badge subject">${escapeHtml(note.subject)}</span><span class="tag-badge chapter">${note.chapterNumber != null ? `Ch. ${escapeHtml(note.chapterNumber)}` : 'Chapter'} · ${escapeHtml(note.chapter)}</span><span class="tag-badge label">${escapeHtml(note.label || 'Notes')}</span></div><h2 class="reader-title">${escapeHtml(note.title)}</h2><button class="btn-ghost btn-sm" data-action="attach-note-asset" data-target-type="note" data-target-key="note"><span class="material-symbols-outlined">add_photo_alternate</span>Attach Visual</button></div><div class="reader-body">${body}</div>${noteAssets}${qas}${mcqs}<div class="reader-actions"><button class="btn-ghost btn-sm" data-action="edit-note" data-note-id="${note.id}"><span class="material-symbols-outlined">edit</span>Edit</button><button class="btn-ghost btn-sm danger-action" data-action="delete-note" data-note-id="${note.id}"><span class="material-symbols-outlined">delete</span>Delete</button></div></div>`;
  show(dom['view-note-reader']);
}

function assetList(note) {
  const assets = note?.assets;
  if (Array.isArray(assets)) return assets;
  if (assets && typeof assets === 'object') return Object.values(assets).filter(asset => asset && typeof asset === 'object');
  return [];
}

function renderTargetAssets(note, type, key) {
  return assetList(note).filter(asset => targetMatches(asset, type, key)).map(assetHtml).join('');
}

function targetMatches(asset, type, key) {
  const target = asset?.target || {};
  if (target.type !== type) return false;
  return target.key === key || (type === 'paragraph' && (target.key === stableKey(key) || target.key === `paragraph-${key}`));
}

function stableKey(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function injectParagraphTargets(body, assets) {
  const normalizedAssets = assetList({ assets });
  let paragraphIndex = 0;
  return body.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (full, attrs, inner) => {
    const plain = stripHtml(inner);
    const key = stableKey(plain);
    const visuals = normalizedAssets.filter(asset => asset?.target?.type === 'paragraph' && (asset.target.key === key || asset.target.key === plain || asset.target.key === `paragraph-${paragraphIndex}`)).map(assetHtml).join('');
    const result = `<p${attrs} data-paragraph-key="${key}">${inner}</p>${visuals}`;
    paragraphIndex += 1;
    return result;
  });
}

function safeResourceUrl(value) {
  try {
    const url = new URL(String(value), location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function assetHtml(asset) {
  const title = asset.title || 'Note visual';
  const sourceUrl = safeResourceUrl(asset.url);
  let visual = '';

  if ((asset.type === 'image' || asset.type === 'vector') && sourceUrl) {
    visual = `<img src="${escapeHtml(sourceUrl)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">`;
  } else if (asset.type === 'diagram') {
    visual = renderDiagram(asset);
  } else if (asset.type === 'graph') {
    visual = renderGraph(asset);
  } else {
    visual = `<div class="asset-placeholder"><span class="material-symbols-outlined">${asset.source === 'ai' ? 'auto_awesome' : 'image'}</span><span>${escapeHtml(title)}</span></div>`;
  }

  return `<figure class="note-asset">${visual}${asset.caption ? `<figcaption>${escapeHtml(asset.caption)}</figcaption>` : ''}${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" class="asset-source">Open resource</a>` : ''}</figure>`;
}

function renderDiagram(asset) {
  const data = asset.data || {};
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  if (!nodes.length) return `<div class="asset-placeholder"><span class="material-symbols-outlined">account_tree</span><span>${escapeHtml(asset.title || 'Diagram')}</span></div>`;
  const markerId = `arrow-${String(asset.id || Date.now()).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const nodeMap = new Map(nodes.map((node, index) => [String(node.id ?? index), { ...node, x: Number(node.x ?? 40 + (index % 3) * 160), y: Number(node.y ?? 35 + Math.floor(index / 3) * 85) }]));
  const lines = edges.map(edge => {
    const from = nodeMap.get(String(edge.from)); const to = nodeMap.get(String(edge.to));
    return from && to ? `<line x1="${from.x + 60}" y1="${from.y + 22}" x2="${to.x}" y2="${to.y + 22}" stroke="currentColor" stroke-width="2" marker-end="url(#${markerId})"/>` : '';
  }).join('');
  const boxes = [...nodeMap.values()].map(node => `<g><rect x="${node.x}" y="${node.y}" width="120" height="44" rx="8" fill="var(--primary-light)" stroke="currentColor"/><text x="${node.x + 60}" y="${node.y + 27}" text-anchor="middle" font-size="11" fill="currentColor">${escapeHtml(String(node.label ?? node.id ?? ''))}</text></g>`).join('');
  const width = Math.max(520, ...[...nodeMap.values()].map(node => node.x + 150));
  const height = Math.max(260, ...[...nodeMap.values()].map(node => node.y + 80));
  return `<div class="visual-svg-wrap"><svg class="note-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(asset.title || 'Diagram')}"><defs><marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="currentColor"/></marker></defs>${lines}${boxes}</svg></div>`;
}

function renderGraph(asset) {
  const data = asset.data || {};
  const points = (Array.isArray(data.points) ? data.points : []).map(point => Array.isArray(point) && point.length >= 2 ? [Number(point[0]), Number(point[1])] : null).filter(point => point && Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!points.length) return `<div class="asset-placeholder"><span class="material-symbols-outlined">show_chart</span><span>${escapeHtml(asset.title || 'Graph')}</span></div>`;
  const minX = Math.min(0, ...points.map(point => point[0])); const maxX = Math.max(1, ...points.map(point => point[0]));
  const minY = Math.min(0, ...points.map(point => point[1])); const maxY = Math.max(1, ...points.map(point => point[1]));
  const sx = value => 55 + ((value - minX) / (maxX - minX || 1)) * 410;
  const sy = value => 220 - ((value - minY) / (maxY - minY || 1)) * 175;
  const polyline = points.map(point => `${sx(point[0])},${sy(point[1])}`).join(' ');
  const xAxis = sy(0); const yAxis = sx(0);
  return `<div class="visual-svg-wrap"><svg class="note-graph" viewBox="0 0 520 260" role="img" aria-label="${escapeHtml(asset.title || 'Graph')}"><line x1="55" y1="${xAxis}" x2="465" y2="${xAxis}" stroke="currentColor"/><line x1="${yAxis}" y1="25" x2="${yAxis}" y2="220" stroke="currentColor"/><polyline points="${polyline}" fill="none" stroke="currentColor" stroke-width="3"/>${points.map(point => `<circle cx="${sx(point[0])}" cy="${sy(point[1])}" r="4" fill="currentColor"/>`).join('')}<text x="260" y="252" text-anchor="middle" font-size="11" fill="currentColor">${escapeHtml(data.xLabel || 'X')}</text><text x="14" y="125" text-anchor="middle" font-size="11" fill="currentColor" transform="rotate(-90 14 125)">${escapeHtml(data.yLabel || 'Y')}</text></svg></div>`;
}
