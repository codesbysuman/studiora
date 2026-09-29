import { exportLibraryFile } from './services/storage.js';
import { createOriginLibrary, compactPatchesBetween, exportLibrary } from './services/library.js';
import { sanitizeAndParseJSON } from './services/json.js';
import { hide, show } from './ui/dom.js';

export function initBackup(dom, store, navigation) {
  dom['btn-backup-open'].addEventListener('click', () => { refreshPatchSelectors(); show(dom['backup-modal']); });
  dom['btn-close-backup'].addEventListener('click', () => hide(dom['backup-modal']));
  dom['btn-export-file'].addEventListener('click', () => exportLibraryFile(store.getState().library));
  dom['btn-export-patch'].addEventListener('click', () => {
    try {
      const library = store.getState().library;
      const start = dom['patch-start'].value;
      const end = dom['patch-end'].value;
      if (!start || !end) throw new Error('Choose both a start and end patch.');
      const bundle = compactPatchesBetween(library, start, end);
      downloadJSON(bundle, `studiora_patch_${start.slice(-12)}_to_${end.slice(-12)}.json`);
    } catch (error) { alert(`Could not export patch range: ${error.message}`); }
  });
  dom['file-import'].addEventListener('change', event => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = sanitizeAndParseJSON(reader.result);
        if (Array.isArray(imported)) store.updateLibrary(createOriginLibrary(imported));
        else {
          if (!imported || typeof imported !== 'object' || !Array.isArray(imported.patches)) throw new Error('Expected a full library export or a legacy notes array.');
          store.updateLibrary(imported);
        }
        alert('Library restored successfully. The imported patch chain is now active.');
        hide(dom['backup-modal']); navigation.subjects();
      } catch (error) { alert(`Failed to restore library: ${error.message}`); }
      event.target.value = '';
    };
    reader.readAsText(file);
  });

  dom['btn-history-open'].addEventListener('click', () => { renderHistory(dom, store); show(dom['history-modal']); });
  dom['btn-close-history'].addEventListener('click', () => hide(dom['history-modal']));

  function refreshPatchSelectors() {
    const patches = store.getState().library.patches;
    const options = patches.map((patch, index) => `<option value="${escapeAttr(patch.id)}">${index === 0 ? 'Origin' : patch.kind} · ${new Date(patch.timestamp).toLocaleString()} · ${escapeText(patch.id.slice(-12))}</option>`).join('');
    dom['patch-start'].innerHTML = options;
    dom['patch-end'].innerHTML = options;
    if (patches.length) {
      dom['patch-start'].value = patches[0].id;
      dom['patch-end'].value = patches[patches.length - 1].id;
    }
  }

  function renderHistory(dom, store) {
    const state = store.getState();
    const patches = [...state.library.patches].reverse();
    dom['history-list'].innerHTML = patches.map((patch, index) => `
      <div class="history-item">
        <div class="history-main"><span class="history-kind">${escapeText(patch.kind)}</span><strong>${escapeText(patch.id)}</strong><time>${new Date(patch.timestamp).toLocaleString()}</time><span>${patch.changes.length} change${patch.changes.length === 1 ? '' : 's'}</span></div>
        <div class="history-actions">${index === 0 ? `<span class="history-current">Current${patch.parentId ? ` · <button class="btn-ghost btn-sm" data-history-undo="${escapeAttr(patch.parentId)}">Undo</button>` : ''}</span>` : `<button class="btn-ghost btn-sm" data-history-rollback="${escapeAttr(patch.id)}">Rollback to here</button>`}</div>
      </div>`).join('');
    dom['history-list'].querySelectorAll('[data-history-undo]').forEach(button => button.addEventListener('click', () => {
      store.replaceFromPatch(button.dataset.historyUndo, 'undo');
      renderHistory(dom, store); refreshPatchSelectors(); navigation.subjects();
    }));
    dom['history-list'].querySelectorAll('[data-history-rollback]').forEach(button => button.addEventListener('click', () => {
      if (!confirm('Rollback will create a new patch that restores the library to this version. Existing history will remain. Continue?')) return;
      store.replaceFromPatch(button.dataset.historyRollback, 'rollback');
      renderHistory(dom, store); refreshPatchSelectors(); navigation.subjects();
    }));
  }
}

function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function escapeText(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function escapeAttr(value) { return escapeText(value); }
