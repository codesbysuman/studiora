export function cacheDom() {
  const ids = [
    'view-subjects', 'view-chapters', 'view-notes-list', 'view-note-reader', 'view-search',
    'app-heading', 'breadcrumb-subtext', 'btn-back', 'global-search',
    'btn-theme-toggle', 'theme-icon', 'btn-toggle-answers', 'btn-header-more', 'header-more-menu', 'active-search-chips', 'btn-library-sync', 'btn-library-tab-my', 'btn-library-tab-online', 'btn-search-clear', 'answers-toggle-icon', 'sort-select', 'btn-sort-menu', 'btn-filter-menu', 'sort-menu', 'filter-menu', 'search-menu',
    'note-modal', 'modal-title', 'btn-open-create', 'btn-close-modal',
    'tab-btn-ai', 'tab-btn-manual', 'tab-panel-ai', 'tab-panel-manual',
    'ai-import-form', 'ai-json-input', 'btn-copy-prompt', 'btn-copy-expand-prompt', 'btn-load-sample',
    'manual-note-form', 'edit-note-id', 'input-subject', 'input-chapter', 'input-title', 'input-body',
    'btn-wrap-term', 'subject-datalist', 'chapter-datalist', 'input-chapter-number', 'input-label', 'input-board', 'input-medium', 'input-level',
    'merge-modal', 'btn-merge-append', 'btn-merge-overwrite', 'btn-merge-new',
    'asset-modal', 'btn-close-asset', 'asset-form', 'asset-target-type', 'asset-target-key', 'asset-target-label', 'asset-type', 'asset-source', 'asset-url', 'asset-title', 'asset-caption', 'asset-prompt', 'term-sheet', 'term-title', 'term-def', 'term-note', 'term-note-block', 'btn-close-term', 'btn-speak-term',
    'patch-modal', 'btn-open-patch', 'btn-close-patch', 'btn-copy-patch-prompt', 'patch-json-input', 'btn-apply-ai-patch', 'patch-note-select', 'patch-target-select', 'patch-context-summary', 'backup-modal', 'btn-backup-open', 'btn-close-backup', 'btn-export-file', 'btn-export-patch', 'patch-start', 'patch-end', 'file-import', 'history-modal', 'btn-history-open', 'btn-close-history', 'history-list'
  ];
  return Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
}

export function show(element) { element?.classList.remove('hidden'); }
export function hide(element) { element?.classList.add('hidden'); }
