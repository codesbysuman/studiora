import { AI_PATCH_PROMPT, AI_PROMPT } from '../prompts.js';
import { createUniqueNote, findCollision, mergeNotes } from '../services/notes.js';
import { sanitizeAndParseJSON } from '../services/json.js';
import { compileBodyWithTerms } from '../services/terms.js';
import { normalizeNote, normalizeSubjectMeta } from '../utils/validation.js';
import { show, hide } from './dom.js';
import { escapeHtml } from '../utils/html.js';

export function initModals(dom, store, navigation) {
  const closeNoteModal = () => hide(dom['note-modal']);
  dom['btn-open-create'].addEventListener('click', () => {
    dom['modal-title'].textContent = 'New Note';
    dom['ai-json-input'].value = '';
    dom['manual-note-form'].reset();
    dom['edit-note-id'].value = '';
    dom['input-label'].value = 'Notes';
    const state = store.getState();
    if (state.activeSubject) dom['input-subject'].value = state.activeSubject;
    if (state.activeChapter) dom['input-chapter'].value = state.activeChapter;
    fillSubjectMeta(dom, state.subjectMeta?.[dom['input-subject'].value] || {});
    switchTab(dom, 'ai'); show(dom['note-modal']);
  });
  dom['btn-close-modal'].addEventListener('click', closeNoteModal);
  dom['tab-btn-ai'].addEventListener('click', () => switchTab(dom, 'ai'));
  dom['tab-btn-manual'].addEventListener('click', () => switchTab(dom, 'manual'));

  dom['btn-copy-prompt'].addEventListener('click', () => copyPrompt(dom['btn-copy-prompt'], AI_PROMPT, 'Copied!'));
  dom['btn-copy-expand-prompt'].addEventListener('click', () => openPatchModal());
  dom['btn-open-patch']?.addEventListener('click', () => openPatchModal());
  dom['btn-close-patch']?.addEventListener('click', () => hide(dom['patch-modal']));
  dom['btn-copy-patch-prompt']?.addEventListener('click', () => copyPrompt(dom['btn-copy-patch-prompt'], buildContextPrompt(), 'Prompt Copied!'));
  dom['patch-note-select']?.addEventListener('change', refreshPatchTargets);
  dom['patch-target-select']?.addEventListener('change', refreshPatchSummary);
  dom['btn-apply-ai-patch']?.addEventListener('click', () => {
    try {
      const payload = sanitizeAndParseJSON(dom['patch-json-input'].value);
      const state = store.getState();
      if (payload.type !== 'smart-notes-patch') throw new Error('This is not a Studiora patch.');
      if (payload.basePatchId && payload.basePatchId !== state.library.headPatchId) throw new Error(`Patch targets ${payload.basePatchId}, but your current library is at ${state.library.headPatchId}. Generate a fresh patch.`);
      if (!Array.isArray(payload.changes) || !payload.changes.length) throw new Error(payload.error || 'Patch contains no changes.');
      store.applyPatchChanges(payload.changes, 'ai_patch');
      dom['patch-json-input'].value = ''; hide(dom['patch-modal']); alert('AI patch validated and applied.');
    } catch (error) { alert(`Patch rejected:
${error.message}`); }
  });
  dom['btn-load-sample'].addEventListener('click', () => {
    dom['ai-json-input'].value = JSON.stringify({
      subject: 'Physics', board: 'General', medium: 'English', level: 'Class 12', chapterNumber: 4,
      chapter: 'Quantum Physics', title: 'Wave-Particle Duality', label: 'Notes',
      body: 'Matter exhibits properties of both particles and waves.\n\nDe Broglie proposed that moving particles have an associated matter wave.',
      terms: [{ word: 'matter wave', def: 'The wavelength associated with a massive particle.', note: 'Formula: λ = h / p' }],
      qas: [{ question: "What is Planck's constant symbol?", answer: 'Denoted by h.' }],
      mcqs: [{ question: 'Which experiment proved electron wave nature?', options: ['Davisson-Germer', 'Rutherford Gold', 'Cavendish', 'Millikan'], answerIndex: 0 }]
    }, null, 2);
  });

  dom['ai-import-form'].addEventListener('submit', event => {
    event.preventDefault();
    try {
      const data = sanitizeAndParseJSON(dom['ai-json-input'].value);
      const parsed = normalizeNote(data);
      parsed.body = compileBodyWithTerms(parsed.body, parsed.terms);
      const state = store.getState();
      const collision = findCollision(state.notes, parsed);
      if (collision) {
        store.setState({ pendingIncomingNote: { existing: collision, incoming: parsed, subjectMeta: normalizeSubjectMeta(data) } });
        show(dom['merge-modal']); return;
      }
      const subjectMeta = { ...state.subjectMeta, [parsed.subject]: normalizeSubjectMeta(data) };
      store.replaceWithNotes([parsed, ...state.notes], subjectMeta, 'create');
      closeNoteModal(); navigation.notes(parsed.subject, parsed.chapter);
    } catch (error) { alert(`JSON Import Issue:\n${error.message}`); }
  });

  dom['btn-merge-append'].addEventListener('click', () => resolveMerge('append'));
  dom['btn-merge-overwrite'].addEventListener('click', () => resolveMerge('overwrite'));
  dom['btn-merge-new'].addEventListener('click', () => resolveMerge('new'));

  function resolveMerge(mode) {
    const pending = store.getState().pendingIncomingNote;
    if (!pending) return;
    const state = store.getState();
    const notes = [...state.notes];
    let result;
    if (mode === 'append') {
      const index = notes.findIndex(n => n.id === pending.existing.id);
      notes[index] = mergeNotes(pending.existing, pending.incoming);
      result = notes[index];
    } else if (mode === 'overwrite') {
      const index = notes.findIndex(n => n.id === pending.existing.id);
      notes[index] = { ...pending.incoming, id: pending.existing.id };
      result = notes[index];
    } else {
      result = createUniqueNote(pending.incoming, notes);
      notes.unshift(result);
    }
    const subjectMeta = { ...state.subjectMeta, [result.subject]: pending.subjectMeta || state.subjectMeta[result.subject] || {} };
    store.replaceWithNotes(notes, subjectMeta, `import_${mode}`);
    store.setState({ pendingIncomingNote: null });
    hide(dom['merge-modal']); closeNoteModal(); navigation.reader(result);
  }

  dom['manual-note-form'].addEventListener('submit', event => {
    event.preventDefault();
    const state = store.getState();
    const id = dom['edit-note-id'].value;
    const fields = {
      subject: dom['input-subject'].value.trim(), chapter: dom['input-chapter'].value.trim(),
      chapterNumber: dom['input-chapter-number'].value === '' ? null : Number(dom['input-chapter-number'].value),
      title: dom['input-title'].value.trim(), label: dom['input-label'].value.trim() || 'Notes', body: dom['input-body'].value.trim()
    };
    const meta = normalizeSubjectMeta({ board: dom['input-board'].value, medium: dom['input-medium'].value, level: dom['input-level'].value });
    if (id) {
      const notes = state.notes.map(note => Number(note.id) === Number(id) ? { ...note, ...fields } : note);
      const subjectMeta = { ...state.subjectMeta, [fields.subject]: meta };
      if (fields.subject !== state.notes.find(n => Number(n.id) === Number(id))?.subject) {
        const oldSubject = state.notes.find(n => Number(n.id) === Number(id))?.subject;
        if (oldSubject && !state.notes.some(n => n.subject === oldSubject && Number(n.id) !== Number(id))) delete subjectMeta[oldSubject];
      }
      store.replaceWithNotes(notes, subjectMeta, 'edit');
      closeNoteModal(); navigation.notes(fields.subject, fields.chapter);
    } else {
      const note = normalizeNote({ ...fields, terms: [], qas: [], mcqs: [] });
      store.replaceWithNotes([note, ...state.notes], { ...state.subjectMeta, [note.subject]: meta }, 'create');
      closeNoteModal(); navigation.notes(note.subject, note.chapter);
    }
  });

  dom['input-subject'].addEventListener('input', () => {
    const meta = store.getState().subjectMeta?.[dom['input-subject'].value];
    if (meta) fillSubjectMeta(dom, meta);
  });

  dom['btn-wrap-term'].addEventListener('click', () => {
    const start = dom['input-body'].selectionStart, end = dom['input-body'].selectionEnd;
    const text = dom['input-body'].value, selected = text.substring(start, end) || 'Term';
    const def = prompt(`Enter definition for "${selected}":`, 'Meaning of the term');
    if (def === null) return;
    const note = prompt('Enter context/hint note (optional):', '') || '';
    const replacement = `<mark class="term" data-def="${escapeHtml(def)}" data-note="${escapeHtml(note)}">${escapeHtml(selected)}</mark>`;
    dom['input-body'].value = text.slice(0, start) + replacement + text.slice(end);
  });

  function openPatchModal() {
    populatePatchNotes();
    refreshPatchTargets();
    show(dom['patch-modal']);
  }
  function populatePatchNotes() {
    const notes = store.getState().notes;
    dom['patch-note-select'].innerHTML = notes.map(n => `<option value="${n.id}">${escapeHtml(n.subject)} · ${escapeHtml(n.chapter)} · ${escapeHtml(n.title)}</option>`).join('') || '<option value="">No notes</option>';
  }
  function selectedPatchNote() { return store.getState().notes.find(n => String(n.id) === String(dom['patch-note-select'].value)); }
  function refreshPatchTargets() {
    const note = selectedPatchNote();
    const options = ['note'];
    if (note) {
      const paragraphs = (note.body || '').replace(/<[^>]*>/g,' ').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
      paragraphs.forEach((_,i)=>options.push(`paragraph:${i}`));
      (note.qas||[]).forEach((_,i)=>{ options.push(`qa-question:${i}`); options.push(`qa-answer:${i}`); });
      (note.mcqs||[]).forEach((_,i)=>options.push(`mcq-question:${i}`));
    }
    dom['patch-target-select'].innerHTML = options.map(v => `<option value="${v}">${escapeHtml(targetLabel(v, note))}</option>`).join('');
    refreshPatchSummary();
  }
  function targetLabel(value,note) { if(value==='note') return 'Entire note'; const [type,index]=value.split(':'); if(type==='paragraph') return `Paragraph ${Number(index)+1}`; if(type==='qa-question') return `Question ${Number(index)+1}`; if(type==='qa-answer') return `Answer ${Number(index)+1}`; if(type==='mcq-question') return `MCQ question ${Number(index)+1}`; return value; }
  function refreshPatchSummary() { const note=selectedPatchNote(); if(!note){dom['patch-context-summary'].textContent='Choose a note to prepare the prompt.';return;} dom['patch-context-summary'].textContent=`${note.title} · ${targetLabel(dom['patch-target-select'].value,note)} · current library version ${store.getState().library.headPatchId || 'none'}`; }
  function buildContextPrompt() {
    const note=selectedPatchNote(); if(!note) throw new Error('Choose a note first.');
    const target=dom['patch-target-select'].value; const [type,index]=target.split(':');
    let context={id:note.id,subject:note.subject,chapter:note.chapter,chapterNumber:note.chapterNumber,title:note.title,label:note.label,board:store.getState().subjectMeta?.[note.subject]?.board,medium:store.getState().subjectMeta?.[note.subject]?.medium,level:store.getState().subjectMeta?.[note.subject]?.level};
    if(type==='paragraph') context.selected={type:'paragraph',index:Number(index),key:`paragraph-${Number(index)}`,content:(note.body||'').replace(/<[^>]*>/g,' ').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean)[Number(index)]||''};
    else if(type==='qa-question'||type==='qa-answer') context.selected={type,index:Number(index),key:`${type}-${Number(index)}`,content:note.qas?.[Number(index)]||null};
    else if(type==='mcq-question') context.selected={type,index:Number(index),key:`mcq-question-${Number(index)}`,content:note.mcqs?.[Number(index)]||null};
    else context.selected={type:'note',content:note};
    if(type==='note') context.note=note;
    return AI_PATCH_PROMPT.replaceAll('CURRENT_PATCH_ID',store.getState().library.headPatchId||'').replace('CURRENT_NOTE_CONTEXT',JSON.stringify(context,null,2));
  }
  return { openEditNote };

  function openEditNote(id) {
    const note = store.getState().notes.find(n => Number(n.id) === Number(id));
    if (!note) return;
    dom['modal-title'].textContent = 'Edit Note';
    dom['edit-note-id'].value = note.id;
    dom['input-subject'].value = note.subject;
    dom['input-chapter'].value = note.chapter;
    dom['input-chapter-number'].value = note.chapterNumber ?? '';
    dom['input-label'].value = note.label || 'Notes';
    dom['input-title'].value = note.title;
    dom['input-body'].value = note.body;
    fillSubjectMeta(dom, store.getState().subjectMeta?.[note.subject] || {});
    switchTab(dom, 'manual'); show(dom['note-modal']);
  }
}

function fillSubjectMeta(dom, meta = {}) {
  dom['input-board'].value = meta.board || '';
  dom['input-medium'].value = meta.medium || '';
  dom['input-level'].value = meta.level || '';
}

function switchTab(dom, tab) {
  const ai = tab === 'ai';
  dom['tab-btn-ai'].classList.toggle('active', ai);
  dom['tab-btn-manual'].classList.toggle('active', !ai);
  dom['tab-panel-ai'].classList.toggle('hidden', !ai);
  dom['tab-panel-manual'].classList.toggle('hidden', ai);
}

async function copyPrompt(button, text, successLabel) {
  try { await navigator.clipboard.writeText(text); button.innerHTML = `<span class="material-symbols-outlined">check</span>${successLabel}`; }
  catch (_) { alert('Clipboard access was unavailable.'); return; }
  setTimeout(() => { button.innerHTML = '<span class="material-symbols-outlined">content_copy</span> Copy Prompt'; }, 2000);
}
