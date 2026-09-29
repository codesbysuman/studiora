import { compileBodyWithTerms } from './terms.js';

export function findNote(notes, id) {
  return notes.find(note => Number(note.id) === Number(id));
}

export function findCollision(notes, incoming) {
  return notes.find(note =>
    note.subject.toLowerCase() === incoming.subject.toLowerCase() &&
    note.chapter.toLowerCase() === incoming.chapter.toLowerCase() &&
    note.title.toLowerCase() === incoming.title.toLowerCase()
  );
}

function mergeByKey(existing = [], incoming = [], key = item => item.question) {
  const map = new Map();
  [...existing, ...incoming].forEach(item => {
    const value = key(item);
    if (value) map.set(String(value).toLowerCase(), item);
  });
  return [...map.values()];
}

export function mergeNotes(target, incoming) {
  const merged = {
    ...target,
    body: `${target.body || ''}`.trim() + '\n\n' + `${incoming.body || ''}`.trim(),
    terms: mergeByKey(target.terms, incoming.terms, item => item.word),
    qas: mergeByKey(target.qas, incoming.qas),
    mcqs: mergeByKey(target.mcqs, incoming.mcqs)
  };

  merged.body = compileBodyWithTerms(merged.body, merged.terms);
  return merged;
}

export function createUniqueNote(incoming, notes) {
  let id = Date.now();
  while (notes.some(note => note.id === id)) id += 1;
  return { ...incoming, id };
}


export function updateNote(notes, id, changes) {
  return notes.map(note => Number(note.id) === Number(id) ? { ...note, ...changes } : note);
}
