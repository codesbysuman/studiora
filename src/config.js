export const APP_NAME = 'Studiora';
export const STORAGE_KEY = 'STUDIORA_LIBRARY_V1';
export const LEGACY_STORAGE_KEY = 'SMART_NOTES_LIBRARY_V2';
export const OLDER_LEGACY_STORAGE_KEY = 'SMART_NOTES_DATA_STREAMLINED';
export const THEME_KEY = 'STUDIORA_THEME';

export const VIEWS = Object.freeze({
  SUBJECTS: 'subjects',
  CHAPTERS: 'chapters',
  NOTES: 'notes',
  READER: 'reader',
  SEARCH: 'search'
});

export const seedNotes = [
  {
    id: 1,
    subject: 'Biology',
    chapterNumber: 1,
    chapter: 'Cell Physiology',
    label: 'Notes',
    title: 'Cellular Respiration Overview',
    body: 'Cellular respiration converts biochemical energy from nutrients into ATP.\n\nThe process begins in the cytoplasm with Glycolysis.',
    terms: [
      { word: 'ATP', def: 'Adenosine Triphosphate: The chemical energy currency of cells.', note: 'Generated via phosphorylation.' },
      { word: 'Glycolysis', def: 'Enzymatic breakdown of glucose into pyruvate.', note: 'Anaerobic step; yields 2 net ATP.' }
    ],
    qas: [{ question: 'Does glycolysis require oxygen?', answer: 'No, glycolysis is an anaerobic process occurring in the cytoplasm.' }],
    mcqs: [{ question: 'What is the net gain of ATP from glycolysis?', options: ['2 ATP', '4 ATP', '36 ATP', '0 ATP'], answerIndex: 0 }]
  }
];
