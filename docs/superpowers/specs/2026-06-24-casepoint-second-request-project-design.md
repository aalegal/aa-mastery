# Casepoint Mock Review Project — "Second Request" Antitrust Case

**Date:** 2026-06-24
**Status:** Approved design, ready for implementation planning

## Summary

Add a new training project to AA Mastery that opens into a **full mock Casepoint
review shell** — a dedicated 3-panel review interface (doc list / document viewer
/ coding panel) parallel to the existing Everlaw shell, branded as Casepoint with a
distinct teal/cyan accent. The scenario is a DOJ Antitrust Division **HSR Second
Request** reviewing the merger of *NorthStar Logistics / Meridian Freight*. The
project card advertises **500 documents**; the trainee actually codes a curated set
of **~15 hand-authored documents**, matching the established pattern of the Everlaw
(P3) and AI (P4) cases.

## Context

The app is a single file (`index.html`, ~5,500 lines). It already ships two full
mock review shells:

- **Relativity** — launched via `openCase()` (Cases 1–2).
- **Everlaw** — `#everlaw-shell`, launched via `openEverlawCase()` from the *Other
  Projects* page (`page-other-projects`), with `ev-*` functions, `P3_DOCS` dataset,
  and `evCoding`/`evAnswered`/`evCodingState` state.

Each project card advertises a document count as backstory (e.g. "510 documents",
"500 documents") while the actual reviewable dataset is a curated ~12–15 documents.
Casepoint becomes a third such platform, modeled on the Everlaw shell.

## Goals

- A new project entry on the *Other Projects* page that opens a Casepoint-branded
  review shell.
- A realistic HSR Second Request / antitrust training scenario.
- ~15 hand-authored, richly detailed reviewable documents.
- Coding workflow with feedback and progress persistence, on par with the Everlaw
  shell.

## Non-Goals (YAGNI)

- No genuine 500-document generation — "500" is backstory metadata only.
- No new Supabase tables.
- No new top-level navigation page (it lives under *Other Projects*, like Everlaw).
- No changes to the Relativity or Everlaw shells.

## Design

### Branding

- Distinct accent: **teal/cyan `#16b5c4`** (with darker `#0fa0b0` variants), chosen
  to differentiate from Everlaw's cornflower blue (`#7eb8f7`) and the app's
  gold/sapphire/emerald tokens.
- Casepoint logo/wordmark text in the shell toolbar and on the project card.

### Components (all added to `index.html`)

1. **Project card** on `page-other-projects`:
   - Teal-bordered `.proj-case-card`, `onclick="openCasepointCase()"`.
   - Badge: "🏛️ Antitrust · DOJ Second Request · Casepoint Platform".
   - Title/subtitle for the NorthStar/Meridian merger.
   - Issue tags (4), "500 documents" backstory line, and live coded/accuracy stats
     (`cp-proj-coded`, `cp-proj-acc`) mirroring `ev-proj-coded`/`ev-proj-acc`.

2. **`#casepoint-shell`** — fixed-overlay div (parallel to `#everlaw-shell`):
   - `cp-toolbar` (logo, case label, close button).
   - `cp-main`: `cp-left` (filter buttons + `cp-doc-list`), `cp-viewer`
     (`cp-doc-header` + `cp-doc-body`), `cp-coding-panel`.
   - `cp-progress-bar` / `cp-progress-fill`.
   - New `cp-*` / `#cp-*` CSS block mirroring the `ev-*` styles, re-skinned teal.

3. **`CP_DOCS`** dataset (~15 docs) — emails, internal memos, and
   spreadsheet/analysis summaries. Each doc:
   `{ id, type, custodian, date, from, to, cc, subject, body, tags, answer, explanation }`
   where `answer` is `{ responsive, privilege, action, conf, issues:[] }`.

### Coding fields

The shell reuses the **same 5-field scoring model** as the Everlaw shell — only the
labels and data change, so the scoring/feedback logic is reused verbatim:

1. **Responsiveness** — Responsive / Not Responsive / Technical Issue
2. **Privilege** — Not Privileged / Privileged / Redact (partial)
3. **Production** — Produce / Withhold / Redact
4. **Confidentiality** — Confidential / Highly Confidential – Outside Counsel Only
   (HSR protective-order tiers)
5. **Issue tags** (multi-select) — Pricing/Bidding · Market Share · Merger
   Rationale · Hot Doc

Submit requires Responsiveness + Production selected (matching Everlaw's
`evCheckSubmit` gating); unset Privilege/Confidentiality default to
not-privileged/standard on submit.

### Logic & data flow

`cp-*` functions mirror the `ev-*` set 1:1:

| Casepoint | Everlaw equivalent |
|-----------|--------------------|
| `openCasepointCase` / `closeCasepoint` | `openEverlawCase` / `closeEverlaw` |
| `cpGetVisible` / `cpFilter` / `cpRenderList` | `evGetVisible` / `evFilter` / `evRenderList` |
| `cpOpenDoc` / `cpRenderDoc` | `evOpenDoc` / `evRenderDoc` |
| `cpLoadCoding` / `cpSelect` / `cpToggleIssue` / `cpCheckSubmit` | `evLoadCoding` / `evSelect` / `evToggleIssue` / `evCheckSubmit` |
| `cpSubmitCoding` / `cpShowFeedback` | `evSubmitCoding` / `evShowFeedback` |
| `cpNav` | `evNav` |
| `cpUpdateProgress` / `cpUpdateLanding` | `evUpdateProgress` / `evUpdateLanding` |

State: `cpCoding = {}`, `cpAnswered = {}`, `cpCodingState`, `cpCurrentDoc`,
`cpCurrentIdx`, `cpFilterMode`.

Shared helpers are **reused, not duplicated**: `esc`, `humanLabel`,
`closeFeedbackOverlay`, and the `rel-feedback-overlay` / `rel-feedback-box` feedback
styles.

### Progress persistence

`cpCoding` / `cpAnswered` are folded into the existing
`saveProgress()` / `loadProgressRemote()` / `loadProgressLocal()` flow alongside
`evCoding` / `evAnswered`, so coding survives reload and syncs to Supabase. The
exact wiring will match how `evCoding` is integrated (verified during
implementation).

## Testing

- Manual walkthrough in the browser (`python -m http.server 8000`):
  open the card → shell renders → code several docs → correct/partial/wrong
  feedback fires → progress bar and landing stats update → reload restores coding.
- Verify HTML escaping: all dynamic doc content rendered via `esc()` / `escAttr()`.
- Confirm no regressions to the Everlaw or Relativity shells.

## Open Questions

None.
