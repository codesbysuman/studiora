# Studiora — Modular Study Notes App

A local-first study-note library designed to evolve into a Next.js/cloud-synced application without throwing away the current data model.

## Current capabilities

- AI master-note generation with terms, Q&A, MCQs, and visual assets.
- Visual assets: images, SVG/vector visuals, diagrams, and graphs with note/paragraph/Q&A/MCQ targets.
- Important-term highlighting with clickable Definition & Context and Read Aloud.
- AI patches can append visual assets and update important terms without rewriting unrelated note content.
- Source code is intentionally kept readable and unminified.

## Phase 2 goals

This phase introduces five foundations:

1. **Immutable patch history** — every library change creates a timestamped, uniquely identified patch linked to its parent.
2. **Undo and rollback** — history is never destroyed. Undo/rollback creates a new patch that restores an earlier state.
3. **Full library export** — exports contain the complete patch chain, not merely the latest notes.
4. **Sync-ready compaction** — given a cloud patch ID, the client can produce one compact patch representing everything after that point.
5. **Better note organization + routing** — chapter numbers, subject metadata, note labels, and hash routing.

---

## Architecture

```text
index.html
  └── src/main.js                 Composition root
       ├── state.js               Reactive app state + library materialization
       ├── ui/navigation.js       Hash router
       ├── ui/render.js           Rendering
       ├── ui/modals.js           Create/edit/import UI
       ├── backup.js              Library export/restore/history UI
       └── events.js              Delegated interaction handlers

Domain/data
  ├── services/library.js         Patch chain + diff/apply/materialization
  ├── services/sync.js            Cloud-sync patch compaction boundary
  ├── services/storage.js         LocalStorage persistence + library export
  ├── services/notes.js           Note operations
  ├── services/json.js            AI JSON parsing/repair
  └── services/terms.js           Interactive term compilation

Support
  ├── utils/validation.js         Note + subject metadata normalization
  ├── utils/html.js               HTML escaping
  ├── prompts.js                  AI prompt contracts
  └── config.js                   Storage keys, views, seed data
```

The important boundary is `services/library.js`. UI code should not understand patch internals.

---

# Library model

The old app stored an array directly in LocalStorage. Phase 2 stores a **Library**.

Conceptually:

```js
{
  schemaVersion: 2,
  libraryId: "library_<unique-id>",
  headPatchId: "patch_<unique-id>",
  patches: [
    {
      id: "patch_<unique-id>",
      parentId: null,
      timestamp: "2026-09-28T...Z",
      kind: "origin",
      changes: [ ... ]
    },
    {
      id: "patch_<unique-id>",
      parentId: "patch_previous",
      timestamp: "2026-09-28T...Z",
      kind: "edit",
      changes: [ ... ]
    }
  ]
}
```

`libraryId` identifies the logical library. In a future authenticated cloud system, the server must additionally scope libraries to the authenticated user/account; the client must never be trusted to choose another user's library.

## Origin patch

The first patch is always `kind: "origin"`.

It contains the initial materialized library state. This makes the complete chain self-contained:

```text
origin
  ↓
edit
  ↓
edit
  ↓
delete
  ↓
rollback
```

A library can therefore be reconstructed from the chain alone.

---

# Patch format

The patch engine uses a small JSON-Patch-style operation set:

```js
{ op: "add",     path: "/notesById/123", value: {...} }
{ op: "replace", path: "/notesById/123/body", value: "new body" }
{ op: "remove",  path: "/notesById/123" }
```

Only these operations are currently supported:

- `add`
- `replace`
- `remove`

Notes are addressed through `notesById`, not array positions. This is deliberate.

### Why not diff the notes array directly?

A normal array diff can turn a one-field edit into:

```text
replace /notes
```

which would transmit the entire library.

Instead, the patch engine internally represents notes as:

```js
{
  notesById: {
    "123": { ...note }
  },
  subjectMeta: { ... }
}
```

Therefore changing one field produces a small patch such as:

```js
[
  {
    op: "replace",
    path: "/notesById/123/body",
    value: "changed content"
  }
]
```

This is the core property that makes the design useful for future cloud synchronization.

---

# Editing lifecycle

All mutations should go through:

```js
store.replaceWithNotes(notes, subjectMeta, kind)
```

which eventually calls:

```text
state.js
  ↓
services/library.js::appendPatch()
  ↓
diff current state → next state
  ↓
create patch with:
  - unique patch ID
  - parent patch ID
  - timestamp
  - kind
  - only changed operations
  ↓
save entire library to LocalStorage
```

Do **not** mutate `state.notes` and call LocalStorage directly.

---

# Undo vs rollback

Both preserve history.

## Undo

Undo means:

```text
current patch
     ↓
parent patch state
     ↓
create NEW "undo" patch
```

The original edit remains in the chain.

Example:

```text
P1 origin
P2 edit body → "B"
P3 undo → body returns to "A"
```

The chain is still:

```text
P1 → P2 → P3
```

## Rollback

Rollback can target any previous patch:

```text
P1 → P2 → P3 → P4
          ↑
       rollback target
```

The app materializes the target state and creates a new `rollback` patch from the current state to that target.

This is intentionally closer to Git's history-preserving model than destructive version deletion.

---

# Sync model

The cloud does not need to receive every local patch separately.

Suppose the cloud already has:

```text
P1 → P2 → P3
```

and the device has:

```text
P1 → P2 → P3 → P4 → P5 → P6
```

The cloud can identify its head as `P3`.

The client calls:

```js
buildSyncPatch(library, "P3")
```

from `services/sync.js`.

The function finds all patches after `P3`, reconstructs the state at `P3`, reconstructs the current state, and generates **one compact patch** representing the net change.

```text
P4 + P5 + P6
      ↓
compact
      ↓
ONE network patch
```

This avoids sending a long sequence of historical edits over the network.

### Important distinction

The local history is **not compacted or destroyed**.

Compaction is only a transport representation for synchronization.

The local chain remains:

```text
P1 → P2 → P3 → P4 → P5 → P6
```

---

# Future cloud sync contract

The future server should conceptually expose something like:

```text
GET /library
  → library head patch ID

POST /library/sync
  client sends:
    libraryId
    basePatchId
    compact changes

  server checks:
    authenticated user owns library
    basePatchId exists
    base state is compatible

  server applies compact patch once
  server creates/records a new server-side head
```

Conflict resolution is **not implemented yet**.

Do not add conflict-merging logic to the current UI. Keep it in a future sync/domain layer.

---

# Library export

The backup button now means **Library**, not merely notes backup.

Exported JSON contains:

- `schemaVersion`
- `libraryId`
- `headPatchId`
- every patch
- every patch's parent ID
- timestamp
- patch kind
- changed operations
- origin state

This means an export is a portable history archive.

Legacy notes-only JSON arrays are still accepted during restore. They are imported as a new origin patch.

---

# Note metadata

## Chapter number

Notes now support:

```js
chapterNumber: 1
```

or `null` when unknown.

The chapter list sorts numbered chapters numerically and displays the number in a circular badge on the left.

This avoids relying on strings such as:

```text
Chapter 10
Chapter 2
```

for ordering.

The chapter number is stored on the note because the current architecture does not yet have a separate Chapter entity.

If chapter becomes a first-class entity later, migration should move this field into that entity.

## Subject metadata

Subjects now have library-level metadata:

```js
subjectMeta: {
  Biology: {
    board: "AHSEC",
    medium: "English",
    level: "Class 12"
  }
}
```

This avoids duplicating board/medium/class data into every note.

## Note labels

Notes support:

```js
label: "Notes"
```

Examples:

- `Notes`
- `PYQ`
- `Revision`
- `Lecture`
- `Formula`
- `Summary`

The default is `Notes`.

A future publishing workflow can use labels as lightweight content classification without requiring a complicated taxonomy.

---

# Hash routing

Phase 2 uses hash routing rather than server-dependent history routing.

Examples:

```text
#/subjects
#/subject/Political%20Science
#/subject/Political%20Science/chapter/2-State
#/note/1738012345678
```

Why hash routing now?

- works from a plain `index.html`
- works on static hosting without rewrite configuration
- browser back/forward works
- easy to migrate later
- no server has to return `index.html` for every route

When moving to Next.js, the hash routes can be replaced by App Router routes.

---

# Current data contract

A note currently looks like:

```js
{
  id: 123,
  subject: "Political Science",
  chapterNumber: 2,
  chapter: "State",
  title: "Meaning of State",
  label: "Notes",
  body: "<h3>...</h3>",
  terms: [
    { word: "State", def: "...", note: "..." }
  ],
  qas: [
    { question: "...", answer: "..." }
  ],
  mcqs: [
    {
      question: "...",
      options: ["...", "...", "...", "..."],
      answerIndex: 0
    }
  ]
}
```

Keep this contract stable while adding features.

---

# AI JSON contract

AI-generated JSON can now include:

```json
{
  "subject": "Political Science",
  "board": "Gauhati University",
  "medium": "English",
  "level": "BA 1st Semester",
  "chapterNumber": 2,
  "chapter": "State",
  "title": "Meaning of State",
  "label": "Notes",
  "body": "<h3>...</h3>",
  "terms": [],
  "qas": [],
  "mcqs": []
}
```

`board`, `medium`, and `level` are stored as subject metadata.

`chapterNumber` and `label` belong to the note.

---

# Current UI

Implemented:

- subjects
- subject metadata display
- numbered chapters
- notes list
- note labels
- reader
- Q&A
- MCQs
- interactive terms
- AI JSON import
- AI continuation merge
- manual create/edit
- delete as a tracked library patch
- immutable patch history
- undo
- rollback
- full library export
- full library restore
- legacy notes-array restore
- hash routing
- search
- theme toggle

---

# What is intentionally NOT implemented yet

- user accounts
- cloud database
- cloud sync API
- authentication
- multi-device conflict resolution
- concurrent patch branches
- server-side patch validation
- collaborative editing
- attachment/file storage
- encryption
- automated tests
- TypeScript
- Next.js

These should be added as separate architectural phases rather than mixed into the current vanilla implementation.

---

# AI-agent rules

Before changing this project, an AI coding agent should read this README completely.

## Rules

1. Treat the Library + patch chain as the source of truth.
2. Never bypass `services/library.js` for persistent content mutations.
3. Never overwrite or delete historical patches for normal undo/rollback.
4. Every content mutation should produce a new patch when the materialized state actually changes.
5. Keep notes addressed by stable ID inside the patch model.
6. Do not turn a field-level edit into a whole-library array replacement.
7. Keep storage-specific code inside `services/storage.js`.
8. Keep sync transport preparation inside `services/sync.js`.
9. Keep UI rendering independent from patch implementation.
10. Keep subject metadata separate from note data.
11. Preserve `chapterNumber`, `label`, and existing note fields when transforming notes.
12. Do not add authentication secrets or API keys to browser code.
13. Do not introduce server-dependent routing while this remains a static app.
14. If the library schema changes, update this README and provide migration logic.
15. Add tests before changing patch semantics.

---

# Recommended next phases

## Phase 3 — correctness

- add unit tests for diff/apply/materialize
- test undo and rollback chains
- test import/export round trips
- test patch compaction
- introduce TypeScript types
- add Zod schemas

## Phase 4 — proper domain model

Potentially promote these into first-class entities:

```text
Library
  ├── Subject
  │    └── Chapter
  │         └── Note
  └── Patch
```

At that point `chapterNumber` should probably belong to `Chapter`, not every Note.

## Phase 5 — Next.js

Suggested migration:

```text
state.js                 → React state / Zustand
ui/render.js             → React components
ui/navigation.js         → Next.js App Router
ui/modals.js             → Client components
services/library.js      → domain/versioning package
services/notes.js        → domain service
services/json.js         → server-side parser
services/storage.js      → repository abstraction
services/sync.js         → sync service
prompts.js               → server-side AI module
utils/validation.js      → Zod schemas
```

## Phase 6 — cloud library

```text
Browser
  ↓
Sync service
  ↓
Authenticated API
  ↓
User's Library
  ↓
Patch chain
```

The server should keep the same fundamental patch identity model so a client can ask:

> “The cloud has patch X. Give me everything after X.”

The client can then compact local history into one network patch.

---

# Running

This is still a static browser application.

You can serve the folder with any static HTTP server. ES modules should be served over HTTP rather than relying on `file://` when possible.

No build step is required.


## Improvement Pass

This build adds:

- fixed app back navigation and browser/system history navigation;
- whole-library ranked search across subjects, chapters, titles, content, labels, terms, Q&A, MCQs, board, medium and class/level;
- subject grouping inferred automatically from metadata (School, Higher Education, Competitive / Exam, General);
- cleaner subject cards with class/level beside the subject name and medium/board as chips below;
- chevrons instead of eye icons for expandable Q&A;
- full-library export containing the complete immutable patch chain;
- selective patch-range export, compacted into one `sync_bundle` patch with its own unique patch ID;
- patch-range export can use any existing patch as the cloud-known base and any later patch as the end point.

### Patch bundle semantics

If the cloud has patch `P10` and the local library contains `P10 -> P11 -> P12 -> P13`, exporting `P10` to `P13` produces one portable bundle. The bundle records `P10` as its parent/base and contains the net field-level changes needed to move the materialized state from P10 to P13. The local patch history is not modified.

This is intentionally export-only for now. A future cloud client can validate the base patch ID, apply the bundle once, and append it as the next cloud patch.


## Improvement: Visual Assets
Notes support patchable `assets` references. An asset can target a note, paragraph, Q&A question, Q&A answer, or MCQ question. Sources may be external URLs, vector/SVG URLs, AI-generation prompts, or custom references. The target is stored with the note so assets survive normal library patch replay.

## Improvement: AI Patches
The old deepening/expand prompt has been replaced by an AI patch prompt. The prompt contains the current library head patch ID and asks an AI to return minimal JSON-Patch-like changes. The app validates the base patch ID and records the accepted changes as an immutable `ai_patch`.

## Improvement: Sorting
A dedicated sort selector is available for note/library views: relevance, title, label, newest, and oldest.


## Latest UI / AI patch improvement
- Search controls are icon-only with sort/filter popover.
- Header and search area are sticky.
- AI changes are contextual: select a note and a focus target before copying the prompt.
- The patch response is pasted back into the same dialog and applied through the immutable patch chain.
- Note asset rendering is part of the reader render path.

## Phase 4 architecture

- **My Library / Online Library:** the local library is the normal working view; Online Library is intentionally a Coming Soon surface.
- **Downloads:** reserved category for future online resources; it is empty until download support exists.
- **Storage:** the patch-chain remains the source of truth. IndexedDB is the durable browser store, with LocalStorage retained as a fast migration/fallback cache.
- **Search:** whole-library search has a clear button plus view-aware sort and filter menus.
- **Visual assets:** note, paragraph, Q&A question, Q&A answer and MCQ targets are supported. Images/vectors use safe HTTP(S) resources; diagrams and graphs can use structured data for deterministic rendering.
- **AI prompts:** master-note and patch prompts explicitly describe the asset contract, deterministic paragraph keys, important terms and rendering targets.
- **Sync:** the My Library Sync control is reserved for the future online service and currently reports Coming Soon without changing local data.
