export function normalizeNote(raw, id = Date.now()) {
  if (!raw || typeof raw !== 'object') throw new Error('Note must be an object.');
  for (const key of ['subject', 'chapter', 'title', 'body']) {
    if (!raw[key] || !String(raw[key]).trim()) throw new Error(`Missing required key: '${key}'.`);
  }

  return {
    id,
    subject: String(raw.subject).trim(),
    chapter: String(raw.chapter).trim(),
    chapterNumber: raw.chapterNumber === '' || raw.chapterNumber == null ? null : Number(raw.chapterNumber),
    title: String(raw.title).trim(),
    label: String(raw.label || 'Notes').trim() || 'Notes',
    createdAt: String(raw.createdAt || new Date().toISOString()),
    body: String(raw.body),
    terms: Array.isArray(raw.terms) ? raw.terms : [],
    qas: Array.isArray(raw.qas) ? raw.qas : [],
    mcqs: Array.isArray(raw.mcqs) ? raw.mcqs : [],
    assets: Array.isArray(raw.assets) ? raw.assets.map(normalizeAsset).filter(Boolean) : []
  };
}

export function normalizeSubjectMeta(meta = {}) {
  return {
    board: String(meta.board || '').trim(),
    medium: String(meta.medium || '').trim(),
    level: String(meta.level || '').trim()
  };
}

function normalizeAsset(asset) {
  if (!asset || typeof asset !== 'object' || !asset.id || !asset.type) return null;
  const allowedTypes = new Set(['image','vector','diagram','graph']);
  const allowedSources = new Set(['url','ai','custom']);
  const type = allowedTypes.has(String(asset.type)) ? String(asset.type) : 'image';
  const source = allowedSources.has(String(asset.source || 'url')) ? String(asset.source || 'url') : 'custom';
  const url = normalizeResourceUrl(asset.url);
  const allowedTargets = new Set(['note', 'paragraph', 'qa-question', 'qa-answer', 'mcq-question']);
  const targetType = allowedTargets.has(String(asset.target?.type)) ? String(asset.target.type) : 'note';
  const targetKey = String(asset.target?.key || 'note');
  return { id: String(asset.id), type, source, url, title: String(asset.title || ''), caption: String(asset.caption || ''), prompt: String(asset.prompt || ''), data: asset.data && typeof asset.data === 'object' ? asset.data : null, target: { type: targetType, key: targetKey } };
}

function normalizeResourceUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}
