# Doc Review Projects & QC Path — Design

**Date:** 2026-08-24
**Status:** Approved for planning

## Problem

The app has sixteen navigation tabs. Four of them are doc-review destinations, and
between them they hold nine case entry points and the QC programme:

| Tab | Contains |
| --- | --- |
| 📁 Projects | Joba v. Bukando, Harmon v. NovaCure, Grupo Velasco Motors (Spanish) |
| 🌐 Other Projects | Veridian Bank (GDPR), SEC v. QuantumEdge AI, and three Casepoint matters |
| 🇧🇷 Foreign Language | CADE v. Consórcio TechBrasil |
| 🔎 QC Track | The QC programme |

Someone opening the app has no way to tell which of those to start with, in what
order, or how any of it connects to becoming QC-ready. The QC programme trains
people on matters that live in three other menus, and nothing says so.

## Goal

One tab — **Doc Review Projects & QC Path** — that is both the catalogue of every
matter and an executable route from "never done this" to "QC-ready". Someone opens
it knowing nothing and can work start to finish without being told what to click.

## Non-goals

- **Not rewriting case content.** The three project pages move in almost verbatim.
- **Not locking progression.** The path recommends an order; nothing is gated.
- **Not authoring new document corpora.** The nine matters stay as they are.
- **Not per-case readiness.** The readiness picture stays global, as specified in
  `2026-08-17-qc-track-design.md`. A person has one Accuracy figure, not nine.

---

## Case inventory

Established by reading the launchers, and corrected in the process. Two facts here
differ from what the Phase 2 work assumed:

| Matter | Corpus | Platform shell | QC key | Certifiable |
| --- | --- | --- | --- | --- |
| Joba v. Bukando | `REL_DOCS` (55) | Relativity | `joba` | No — 55 docs |
| Harmon v. NovaCure | `CASE2_DOCS` (55) | Relativity | — | No |
| **SEC v. QuantumEdge AI** | `P4_DOCS` (500) | **Relativity** | `p4` | Yes |
| Veridian Bank — GDPR | `P3_DOCS` (510) | Everlaw | `p3` | Yes |
| CADE v. Consórcio TechBrasil | `PTBR_DOCS` (500) | Everlaw | `ptbr` | Off by default |
| NorthStar v. Meridian | `CP_DOCS` | Casepoint | — | No |
| St. Aurelius — data breach | `SAH_DOCS` | Casepoint | — | No |
| TransRidge v. Cascade Headwaters | `FA_DOCS` (500) | Casepoint | `firstam` | Yes |
| **Grupo Velasco Motors** (Spanish) | **none — see below** | Relativity | — | No |

**Correction carried into this work:** `QC_CASES.p4` is labelled "Project 4". It is
actually **SEC v. QuantumEdge AI**, launched by `openAICase()` which delegates to
`openCase(4)` — the Relativity shell, not a separate one. The label is fixed as part
of this change.

`CP_DOCS` and `SAH_DOCS` carry answer keys but have no QC configuration. They remain
first-pass only, and their library cards say so.

### One of the nine does not work

**Grupo Velasco Motors v. TechDrive Automóvil** is a Spanish-language patent matter on
the Projects page whose button reads *"Abrir en OEPM →"* and calls `openCase(3)`.
`openCase` handles only 2 and 4 explicitly; everything else falls to `else`, which
loads `REL_DOCS`. **Clicking that card opens the English Joba trade-secret case,
labelled "Joba v. Bukando".** There is no Spanish corpus anywhere in the file.

This is a pre-existing bug, not one this change introduces — but this change re-parents
that exact card, so leaving it would mean knowingly moving something broken into a tab
whose whole purpose is telling people where to go. `CLAUDE.md` compounds it by claiming
case 3 is Veridian Bank, which matches neither the code nor the card.

The card is treated as unbuilt content. It moves into the library marked **"Not yet
available"** with the button disabled, and `CLAUDE.md`'s stale line is corrected. If a
Spanish corpus is planned, wiring it up is separate work with its own answer keys.

---

## Structure

A single page, `page-review`, replacing `page-projects`, `page-other-projects`,
`page-foreign-review` and `page-qc`. Navigation goes from sixteen tabs to thirteen.
The seven existing `nav('projects')` / `nav('other-projects')` / `nav('foreign-review')`
links on the home page repoint to it.

The page has two zones:

**The Path**, permanently at the top. Six numbered stages, each showing its state and
carrying a single primary action. The first incomplete stage is marked *Start here*.

**The Library**, below. Every matter, grouped by platform using the same sub-tab
mechanic as the leadership and admin sections (`showLead` / `showAdminTab`): a
`showReviewTab(id, btn)` over `.vpane` divs. Content from the three old pages is
re-parented, not rewritten.

Nothing locks. The path tells you where to go; the library lets you go anywhere.

---

## The Path

| # | Stage | What it is | Complete when | Action |
| --- | --- | --- | --- | --- |
| 1 | Know the rules | Reference, eDiscovery Playbook, QC error taxonomy | Self-marked | Open the taxonomy |
| 2 | First-pass review | Joba v. Bukando — 55 documents, the on-ramp | ≥25 documents coded | Open Joba |
| 3 | Review at scale | Any larger matter, on any platform | ≥50 documents coded in one | Choose a matter |
| 4 | QC practice | Catch a prior reviewer's errors under dense seeding | ≥1 practice batch | Start a practice batch |
| 5 | QC certification | The real bar: 250 documents at 2% error density | ≥1 certification batch | Choose a matter |
| 6 | Readiness | Your three pillars and what to practise next | Always open | View readiness |

### Status model

Each stage is `done`, `next`, or `available`. Exactly one stage is `next` — the first
that is not done. Every stage is clickable regardless of state, including stages after
`next`. The distinction is advisory only, which is the point: an experienced reviewer
who already knows a matter should not be blocked at 9pm because a stage was not ticked.

### Completion signals

Stages 2 and 3 read the live coding state the simulators already maintain —
`relCoding`, `cpCoding` and `evCoding`, each an object keyed by document id — so
progress self-marks rather than asking anyone to tick a box.

The thresholds (25 documents for Joba, 50 for a larger matter) are calibration, not
law. They exist so that opening a case and coding two documents does not read as
"done". They live in one constant.

Stage 1 has no observable signal — nobody can detect reading — so it is self-marked:
the stage carries a **"Mark as read"** control, and the flag is stored in localStorage
under the existing per-user progress key. No new table. It is reversible, because
someone who ticks it by accident should be able to untick it.

Stages 4, 5 and 6 read `qcAttempts`, which is already loaded by the QC code.

### Engine boundary

Stage derivation is pure and lives in `qc-engine.js`:

```js
QC.pathStatus({
  attempts:        [...],            // qc_attempts rows
  firstPassCounts: { joba: n, scale: n },
  marked:          { rules: bool }
})
// -> [{ key, status }, ...] in stage order
```

The renderer supplies the inputs and draws the result. Keeping this pure means the
path's logic is unit-tested rather than tangled in DOM code, and it is the only new
logic this change introduces.

---

## Making every case complete

Stage 5 is only meaningful if the matters it offers deliver the whole drill. Three of
the five QC-capable cases are currently incomplete.

### Interrupt scripts for Veridian, QuantumEdge and CADE

`QC_INTERRUPTS` covers only `joba` and `firstam`. Without a script a case fires no
interrupts, so Responsiveness scores `null` and instruction-drift never occurs. Each
of the three gets the standard three messages — acknowledge, protocol change,
feedback — written against that matter's own subject matter and coding vocabulary:

- **Veridian Bank** — GDPR, biometric and financial data, ICO/CNIL/BaFin enforcement
- **SEC v. QuantumEdge AI** — securities fraud, FINRA certification, position limits
- **CADE** — Brazilian antitrust. Messages in **Portuguese with an English gloss**: a
  PM writing to a Portuguese-language review team would not write in English, and the
  drill is less realistic if they do.

### A protocol change that matches nothing is a silent no-op

This is the sharpest risk in the change. A `when` predicate that matches no document
in its corpus produces no `effectiveAnswer`, so instruction-drift never fires, the
compliance diagnostic reads `null`, and **nothing anywhere reports a problem** — the
drill just quietly loses its most important mechanic.

Every scripted change therefore gets a test asserting it matches a meaningful share of
its own corpus: at least 5% of documents, and at least 10 documents outright.

### Escalate becomes conditional

`QC_AMBIGUOUS` is empty for `p3`, `p4` and `ptbr`, and it should stay that way. Those
corpora contain no ambiguous documents: every hand-authored explanation states a firm
call. Searching all three for close-call language returned only false positives —
`VB-0003` matches on "defensible" but reads *"ACP. GC seeking legal advice… privileged.
Withhold"*, which is a confident answer. TransRidge was different only because
`fa-flag` gave an explicit Flag & Escalate coding to key on.

So the **Escalate button appears only when that case has a non-empty ambiguity list.**
Those three matters then deliver Accuracy, Pace, Responsiveness and Consistency
honestly, with escalation simply not part of the drill.

This needs no scoring change. With an empty list neither `OVER_ESCALATION` nor
`MISSED_ESCALATION` can trigger, so the engine is already correct — it is a UI change
only. If close calls are added to a case later, the button reappears on its own.

### Stage 5's offer

Three certification matters, each with the complete drill: **TransRidge**,
**Veridian Bank**, and **SEC v. QuantumEdge AI**. CADE stays off certification by
default — it is the foreign-language review and belongs only to reviewers who do that
work — and can be switched on in the leadership target editor.

Joba is never offered for certification. 55 documents against a 250-document batch is
structural, and correct: it is the practice on-ramp.

---

## The Library

Three platform sub-tabs, reflecting how the content already splits:

- **Relativity** — Joba, Harmon, SEC v. QuantumEdge AI, Grupo Velasco (unavailable)
- **Everlaw** — Veridian Bank, CADE
- **Casepoint** — NorthStar, St. Aurelius, TransRidge

Every card keeps its existing markup and gains one line saying what it supports:
*first-pass review*, *first-pass + QC practice*, or *first-pass + QC practice +
certification*. That line is derived from `QC_CASES` and `qc_projects`, not hardcoded,
so it cannot drift out of step with what the drills actually offer.

---

## Files

| File | Change |
| --- | --- |
| `qc-engine.js` | Add `QC.pathStatus`. No other logic changes. |
| `tests/qc-engine.test.js` | Tests for `pathStatus`, and for each protocol-change predicate matching its corpus. |
| `index.html` | New `page-review`; nav consolidation; path renderer; library sub-tabs; re-parented case content; conditional Escalate; three interrupt scripts; `p4` label fix; Grupo Velasco marked unavailable. |
| `CLAUDE.md` | Correct the stale "Case 3: `P3_DOCS` — GDPR/AI" line. |

No migration. No new table. Stage 1's flag rides the existing progress key.

---

## Risks

- **A silent protocol-change no-op.** Covered by the corpus-match test above. This is
  the failure that would be hardest to notice in use.
- **Re-parenting breaks case launchers.** The nine cases open modal shells by id
  (`everlaw-shell`, `cp-shell`, `rel-shell`), which are siblings of the page divs
  rather than children, so moving card markup should not affect them. Every launcher
  gets an explicit post-move check.
- **Threshold calibration.** 25 and 50 documents are reasoned, not observed. One
  constant to change if they read wrong in use.
- **A long page.** The path plus a platform sub-tab of case cards is a lot of vertical
  space. The library sub-tabs keep only one platform visible at a time, which is the
  main mitigation; if it still reads long, the path collapses to a summary strip once
  every stage is done.
- **Losing a familiar tab.** Three menu entries people use today disappear. The home
  page links repoint, so the routes people actually click still work.

## Deferred

- QC configuration for `CP_DOCS` (NorthStar) and `SAH_DOCS` (St. Aurelius). Both carry
  answer keys and could become QC-capable; each needs a vocabulary check and a set of
  interrupt scripts. Their library cards say "first-pass review" until then.
- Ambiguity lists for Veridian, QuantumEdge and CADE. These need legal judgement about
  what is genuinely escalate-worthy, not a textual heuristic. The conditional Escalate
  button means their absence costs nothing today.
- Per-case readiness. Readiness stays global.
