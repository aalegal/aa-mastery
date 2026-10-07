# Cyber Incident Response — PII/PHI Extraction on Relativity

**Date:** 2026-09-25
**Status:** Design approved in brainstorming; awaiting spec review
**Branch:** `feat/cyber-incident-response`

## Goal

Add a seventh training matter that teaches the other half of breach work: not
coding documents, but **mining them** — finding every affected person in each
document and recording who they are and which sensitive data elements were
exposed, so a client can meet HIPAA and state breach-notification duties.

It runs inside the existing Relativity shell, graded against an answer key like
every other matter, with feedback that shows each mistake where it happened.

## Decisions made in brainstorming

| Question | Decision |
|---|---|
| Where the template comes from | A standard template built from HIPAA's identifiers and the data elements US state breach laws trigger on |
| What each row records | Typed identity values (name, DOB, mailing address) plus a tick box per data element |
| De-duplication across documents | Out of scope. One row per person per document, graded per document |
| Pace target | 15 documents per hour (dense material) |
| Where the work lives | Approach A: an extraction mode inside the real Relativity shell |
| Screen layout | Layout C: a full-width spreadsheet drawer that slides up over the shell |

## The matter

**Larkspur Benefit Services — Cyber Incident Response.** A fictional
health-benefits administrator suffers a ransomware attack; the attacker
exfiltrates a file share. Outside counsel engages the review team to mine the
stolen files for affected individuals and exposed data elements so Larkspur can
notify people under HIPAA and state law.

A benefits administrator is chosen deliberately: it holds employer HR data
(SSNs, bank accounts for direct deposit, driver's licenses) **and** health-plan
data (member IDs, claims with diagnoses), so reviewers meet real PII and real
PHI. Under HIPAA, Larkspur is a *business associate* of the health plans it
serves, not a covered entity — a nuance the protocol explains. It does not
overlap St. Aurelius (a hospital, redaction training, on Casepoint).

Matter ID **5** in the Relativity shell (QuantumEdge keeps **4**).

## The document set

About **150 documents**, in **6 batches of 25** that unlock in order. At 15 an
hour that is roughly 10 hours of practice; one batch is about 1¾ hours.

| Kind | Approx. count | What it teaches |
|---|---|---|
| Enrollment and census rosters (tables of 10–40 people) | 20 | Density, dependents, rows below a page break |
| Claims forms and explanations of benefits | 25 | PHI; the provider is not an affected individual |
| Visit notes and medical records | 15 | Diagnosis, treatment and medication as PHI |
| W-2s | 10 | SSN and address |
| Direct-deposit forms | 10 | Financial account numbers |
| I-9s | 8 | Driver's license, passport |
| Emails carrying PII in the body or a quoted attachment | 22 | PII outside a form |
| No PII at all (policies, IT tickets, vendor marketing, meeting notes) | 40 | The quick "no PII/PHI" call (about a quarter of the set) |

**Custodians:** Benefits Operations, HR, Claims, IT, Finance.

**Deliberate judgment traps**, spread across the set:

- Business contact details (a work email, an office address) — not PII.
- Doctors and other providers named on claims — not affected individuals.
- Masked or last-4-only SSNs (`XXX-XX-1234`) — do not count as an SSN. A person
  whose only data is a masked SSN is not recorded at all (rule 8); a person with
  a masked SSN and, say, a member ID is recorded with the SSN box left empty.
- The same person twice in one document — one row, elements merged.
- A data element with no name attached (an SSN in a log line) — not recorded.
- A name with no data element (a newsletter mailing list of names and addresses)
  — not recorded.
- Dependents, including minors — recorded as affected individuals.
- The last rows of a long roster sitting below a page break.

### Fake-data safety

- Every SSN uses area 900–999 with group `00` — a combination issued neither as
  an SSN nor as an ITIN, so no generated number belongs to a real person.
- Phone numbers use the reserved `555-01xx` range; emails use `example.com`.
- Card numbers are standard published test numbers.
- Every document and the protocol carry the fictional-matter label.

## The extraction template

One row per affected person in the document.

**Identity — typed values:** First name · Last name · Date of birth · Street ·
City · State · ZIP

**Data elements — tick boxes:**

| PII (state breach-law triggers) | PHI (HIPAA) |
|---|---|
| SSN · Driver's license / state ID · Passport · Financial account · Payment card · Login credentials · Biometric | Medical record no. · Health plan / member ID · Medical info (diagnosis, treatment, medication) |

Element keys in data and code: `ssn`, `dl`, `passport`, `fin`, `card`, `login`,
`bio`, `mrn`, `plan`, `med`.

**Per-document control:** a **"No PII/PHI in this document"** box. A document
must end with **either** at least one row **or** that box ticked. Neither is an
incomplete document; both is a contradiction. Either state blocks Submit.

## Extraction rules (these are the protocol's rules)

1. One row per person per document. A person who appears twice in one document
   is merged into a single row.
2. Record only individuals the document names. Unnamed data is not recorded.
3. Type the name as the document gives it, first and last only.
4. Leave a field blank when the document does not show it. Never infer an
   address or a date of birth.
5. Business contact details are not PII. Providers are not affected individuals.
6. A masked or last-4-only SSN does not count as an SSN.
7. Dependents, including minors, are affected individuals.
8. Record a person only when at least one data element in the template is
   exposed for them. A name with only an address, or with only a masked SSN, is
   not an affected individual and gets no row.

## Screen and interaction

The Relativity shell keeps its toolbar, sidebar, document list and viewer. For
this matter the right-hand coding panel and the mode switcher (Standard /
Redaction / PLOG) are hidden, and a **full-width drawer** slides up over the
lower half of the shell. The document stays readable above it.

**Drawer header**, left to right: document ID and kind · *Affected individuals
· N* · **No PII/PHI in this document** · **Previous** · **Submit & Next** ·
**Collapse**. Collapsed, the drawer is a one-line summary, for example
*"3 individuals · 2 SSN · 1 medical"*.

**The grid:** 7 typed columns and 10 tick-box columns, all visible without
horizontal scrolling at 1024 px wide. Each row has a delete button; *+ Add
person* adds one.

**Keyboard-first:**
- Tab / Shift+Tab move across cells; Space ticks a box.
- Enter on a row's last cell starts a new row.
- Ctrl+Enter submits and moves to the next document.

**Entry-time validation**, so grading holds no surprises:
- A row needs a first and a last name, and at least one ticked box, before Submit.
- A date of birth must have a four-digit year.

**Sidebar for this matter:** saved searches become document kinds (*Rosters,
Claims, Medical, HR, Email, Other*); custodians and batches work as they do for
QuantumEdge; the *By Issue* section is hidden (this matter has no issues). The
toolbar's *Uncoded / Coded* filters read the extraction store for this matter.

## Grading

### Matching

Each entered row is matched to an answer-key person by **normalized name**:
case, punctuation, extra spaces and middle initials are ignored. A name within
an edit distance of 2 of a key name — measured on first and last name together —
counts as **the same person with a typo** (a field error on the name), not a
missed person plus an extra one. When two key people in one document share a
name, date of birth decides which is which; failing that, address; failing that,
document order.

Unmatched key people are **missed individuals**; unmatched rows are **extra
individuals**.

### Normalization

| Field | Compared as |
|---|---|
| Date of birth | A calendar date in US order (month first): `3/14/1986`, `03-14-1986`, or `1986-03-14`; the year must have four digits |
| Street | Case- and punctuation-insensitive; common abbreviations equal (St/Street, Ave/Avenue, Ct/Court, Ln/Lane, Rd/Road, Dr/Drive, Blvd/Boulevard, Apt/Apartment, Ste/Suite, N/North and the other compass points) |
| City | Case-insensitive |
| State | Two-letter code; a full state name is converted |
| ZIP | First five digits (ZIP+4 accepted) |
| Any field | Blank against blank is correct; a value against a blank is an error either way |

### Defects

| Defect | What it costs the client | Weight |
|---|---|---|
| Missed individual | Someone who should be notified is not | 5 |
| Missed data element | The letter understates the exposure; can change which laws apply | 3 |
| Extra individual | Over-notification: cost, and needless alarm | 2 |
| Extra data element | Overstates the exposure | 1 |
| Identity field error | The letter is misaddressed or cannot be matched | 1 |

"No PII/PHI" errors are expressed through these: ticking the box on a document
that has people yields a missed individual for each of them; entering rows on a
document with none yields an extra individual for each row.

A document is **perfect** when it has zero defects.

### Feedback

After Submit, the drawer switches to a review state (as mocked up in
brainstorming):

- **Header:** total defects and total weight, plus a count per defect type.
- **Correct rows:** marked with a green edge.
- **Wrong values:** outlined in red, with the correct value shown.
- **Boxes that should have been ticked:** outlined in dashed red.
- **Extra individuals:** struck through, with the reason (for example, *treating
  provider*).
- **Missed individuals:** their full correct row is appended in red, with where
  they were in the document.
- Every defect carries its one-line reason from the answer key.
- Buttons: **Review again** (re-read your submitted rows against the key) and
  **Next document**.

**The first submission is the graded one.** The feedback reveals the full correct
rows, so a resubmission would be trivially perfect and accuracy would stop
meaning anything. Returning to a submitted document shows its feedback; it cannot
be resubmitted. The toolbar's **Reset** clears this matter's extraction progress,
as it does for coding progress.

## Progress

Shown in the sidebar for this matter:

- **Accuracy:** the share of submitted documents with zero defects.
- **Defect breakdown:** a count of each defect type.
- **Pace:** documents per hour in the current working session, against the 15
  target. A gap of more than 30 minutes between submissions starts a new session,
  so an overnight break does not drag the figure toward zero. Computed with the
  existing `QC.paceStats` over that session's submission times, so it behaves like
  every other pace figure on the site.

Progress does not feed the QC Track or the QC path's stages in this version.

## Architecture

| Piece | Responsibility |
|---|---|
| Relativity matter registry (in `index.html`) | Replaces the hardwired `openCase`. Each matter declares its documents, labels, saved searches, and whether it uses the coding panel or the extraction drawer. QuantumEdge (ID 4) must behave exactly as today. |
| `cir-docs.js` | The generated documents and answer keys. Loaded by a `<script>` tag so `index.html` does not grow. |
| `tools/build_cir_docs.py` | Deterministic, seeded generator for `cir-docs.js`. Refuses to write a set that fails its checks (see Testing). |
| `extraction-engine.js` | Pure grading logic, UMD-wrapped like `qc-engine.js`, no DOM: normalization, matching, defect classification, weights, summary figures. |
| Drawer, feedback and progress UI (in `index.html`) | Rendering and keyboard handling only; all judgement comes from the engine. |
| Library card and protocol link | A card in the Relativity pane; an entry in `REVIEW_LIBRARY` and `REVIEW_PROTOCOLS`. |
| `vercel.json` | `cir-docs.js` and `extraction-engine.js` excluded from the SPA catch-all. |

### Document shape (`cir-docs.js`)

```js
{
  id: 'LBS-0042',
  kind: 'roster',            // roster | claim | visit-note | w2 | direct-deposit | i9 | email | policy | it-ticket | marketing | meeting-notes
  custodian: 'cust-benefits',
  title: 'Q1 enrollment census — Pierce County employers',
  date: 'March 3, 2025',
  // exactly one content block, by kind:
  table: { caption, columns: [...], rows: [[...], ...], pageBreakBefore: 38 },
  // form:  { heading, sections: [{ label, fields: [[label, value], ...] }] }
  // email: { from, to, cc, subject, body }
  // text:  '...'
  answer: {
    noPii: false,
    people: [{
      first, last, dob, street, city, state, zip,      // '' when the document does not show it
      el: { ssn, dl, passport, fin, card, login, bio, mrn, plan, med },  // booleans
      why: { person: '...', fin: '...' }               // reasons shown in feedback
    }],
    notPeople: [{ name: 'Dr. Meera Patel', why: 'Treating provider; business contact details.' }]
  }
}
```

### Reviewer entry (`relExtract[docId]`)

```js
{ noPii: false, rows: [{ first, last, dob, street, city, state, zip, el: {...} }],
  submittedAt: '2026-09-25T14:03:11Z', result: { defects: [...], weight: 11, perfect: false } }
```

### Engine API (`extraction-engine.js`)

- `normalizeName`, `normalizeDob` (to `YYYY-MM-DD` or `null`), `normalizeStreet`,
  `normalizeState`, `normalizeZip`
- `matchPeople(keyPeople, rows)` → `{ pairs: [{ key, row, nameTypo }], missed, extra }`
- `gradeDocument(answer, entry)` → `{ defects: [{ type, weight, person, field, expected, got, why }], weight, perfect }`
- `DEFECT_WEIGHTS` = `{ MISSED_INDIVIDUAL: 5, MISSED_ELEMENT: 3, EXTRA_INDIVIDUAL: 2, EXTRA_ELEMENT: 1, FIELD_ERROR: 1 }`
- `summarize(results)` → `{ submitted, perfect, accuracy, breakdown }`

## Persistence

Extraction entries are saved like other progress: to local storage always, and
to the `reviewer_progress` row for signed-in users. That needs one new column:

```sql
alter table public.reviewer_progress add column if not exists rel_extract jsonb;
```

Jeff runs this in the Supabase SQL editor.

**Failure mode designed around:** if the app sent `rel_extract` before the column
existed, the database would reject the **entire** save, taking every other
matter's progress down with it. So the remote save sends `rel_extract`, and if
the database rejects it for an unknown column, retries once without it and
stops sending it for the rest of the session. Until the column exists, extraction
progress is saved locally and every other matter keeps saving normally.

## Protocol PDF

A seventh protocol, *Larkspur Benefit Services — Cyber Incident Response*,
offered above the library card like the other six. The PDF builder gains an
**extraction layout**, because this matter needs different sections:

1. Matter overview (including the business-associate nuance)
2. Parties and custodians
3. The extraction template
4. How to extract (the rules above)
5. Data elements — what counts (for each element, what qualifies and what does not)
6. Judgment traps
7. Pace and output (15 documents per hour for this matter)
8. Escalation and the QC standard (the shared table, with pace shown as 15 per
   hour for this matter rather than the coding matters' 60)

## Testing

1. **Engine, test-first** (`tests/extraction-engine.test.js`, run with
   `node --test`); each test fails before the code exists:
   - every date-of-birth format, street abbreviation, full state name and ZIP+4;
   - name matching: exact, a typo within reach, two people with one name split by DOB;
   - every defect type and its weight;
   - all three "no PII" outcomes: correct; rows on an empty document; the box ticked on a document with people;
   - blank against blank;
   - a row with no ticked box is refused at entry, and a person with no element is never expected.
2. **Generator checks**, which fail the build rather than write a bad set:
   - every answer-key person's name, date of birth and address appear verbatim in their document;
   - no SSN outside area 900–999 with group `00`;
   - no "no PII" document contains anything PII-shaped;
   - each trap appears its intended number of times;
   - no provider on a claim is ever in the answer key, and a masked SSN never ticks the SSN box;
   - every answer-key person has at least one data element (rule 8).
3. **QuantumEdge regression, before any Larkspur screen work:** three columns,
   50 rows, sidebar counts that match their filters, and 5/5 on a correctly coded
   document.
4. **Browser, as a reviewer:** open from the library card; drawer opens;
   Tab / Space / Enter / Ctrl+Enter; a half-filled row blocks Submit, and so do
   rows alongside "No PII/PHI"; feedback shows each defect type as mocked up;
   collapse and expand; batches unlock in order; progress figures add up and
   survive a reload; with the new column missing, every other matter still saves.
5. **Protocol PDF:** section references resolve, no document IDs, nothing
   SSN-shaped, every page rendered and reviewed.

## Out of scope for this version

- De-duplication across documents (a separate exercise later).
- Feeding extraction into the QC Track or the QC path's stages.
- Capturing full values for SSNs, account numbers or medical details — by
  design; the template records that they were exposed, not the values.
