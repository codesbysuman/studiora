function plainText(value = '') {
  return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function fieldsFor(note, subjectMeta = {}) {
  return [
    ['subject', note.subject, 9],
    ['chapter', note.chapter, 8],
    ['title', note.title, 10],
    ['label', note.label || 'Notes', 5],
    ['body', plainText(note.body), 3],
    ['terms', (note.terms || []).map(t => `${t.word} ${t.def} ${t.note || ''}`).join(' '), 6],
    ['questions', (note.qas || []).map(q => `${q.question} ${q.answer}`).join(' '), 7],
    ['mcq', (note.mcqs || []).map(q => `${q.question} ${(q.options || []).join(' ')}`).join(' '), 6],
    ['board', subjectMeta.board || '', 4],
    ['medium', subjectMeta.medium || '', 4],
    ['level', subjectMeta.level || '', 4]
  ];
}

export function searchLibrary(notes, subjectMeta = {}, query = '') {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return notes.map(note => {
    const fields = fieldsFor(note, subjectMeta[note.subject]);
    let score = 0;
    const matched = [];
    for (const [field, value, weight] of fields) {
      const text = String(value).toLowerCase();
      let fieldMatched = false;
      for (const term of terms) {
        if (!text.includes(term)) continue;
        fieldMatched = true;
        score += weight;
        if (text === term) score += 20;
        else if (text.startsWith(term)) score += 8;
        else if (text.includes(` ${term}`)) score += 4;
      }
      if (fieldMatched) matched.push(field);
    }
    return score ? { note, score, matched: [...new Set(matched)] } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.note.title.localeCompare(b.note.title));
}
