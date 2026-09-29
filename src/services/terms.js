import { escapeHtml, escapeRegex } from '../utils/html.js';

export function compileBodyWithTerms(bodyText, termsList = []) {
  if (!bodyText || !Array.isArray(termsList) || !termsList.length) return bodyText || '';

  let compiled = bodyText;
  for (const term of termsList) {
    if (!term?.word) continue;
    const word = term.word.trim();
    const regex = new RegExp(`\\b(${escapeRegex(word)})\\b(?![^<]*>|[^<>]*<\\/mark>)`, 'gi');
    const def = escapeHtml(term.def || '').replace(/"/g, '&quot;');
    const note = escapeHtml(term.note || '').replace(/"/g, '&quot;');
    compiled = compiled.replace(regex, `<mark class="term" data-def="${def}" data-note="${note}">$1</mark>`);
  }
  return compiled;
}
