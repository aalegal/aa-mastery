# Design: Project 6 — St. Aurelius Health Data Breach (Casepoint)

**Date:** 2026-07-07
**Status:** Approved

## Goal

Add a second Casepoint project to AA Mastery: a US hospital data-breach review
that trains reviewers on PII, PHI, and SBI identification plus hands-on,
graded redaction — complementing the existing VeridianBank GDPR breach
(Everlaw) and the NorthStar/Meridian antitrust matter (Casepoint).

## Case narrative

**St. Aurelius Health System** — fictional regional hospital network. The
"CryptVault" ransomware group exfiltrated ~2.1M patient records before
encrypting systems. The review supports *Doe v. St. Aurelius Health System*
(putative class action) and a parallel HHS OCR investigation.

- Document ID prefix: `SAH-` (`SAH-0001` … `SAH-0400`)
- Breadcrumb: **Doe v. St. Aurelius Health** › First Level Review › Breach Litigation

**Issue tags:**

| Tag | Label | Focus |
|---|---|---|
| issue1 | Security Failures | Pre-breach vulnerabilities, ignored audits, unpatched systems |
| issue2 | Breach Timeline & Notification | Discovery date, notification delay, who-knew-when |
| issue3 | Incident Response & Remediation | Containment, forensics, remediation decisions |
| issue4 | Hot Doc | Smoking-gun content |

## Document set

**15 handwritten teaching docs** covering incident-response review traps:

1. Forensic report commissioned by outside counsel — work product (withhold)
2. Routine pre-breach security audit — NOT privileged despite sounding legal
3. PR/comms draft with lawyer cc'd — not privileged (counsel cc ≠ privilege)
4. Ransom negotiation transcript — responsive, hot doc
5. HR spreadsheet with employee SSNs/addresses — produce with PII redactions
6. Patient complaint emails with diagnoses — produce with PHI redactions
7. Board memo on cyber-insurance limits + pending acquisition — SBI redactions
8. Encrypted/corrupted file — Technical Issue
9. Personal email — non-responsive
10. Ignored penetration-test warning email — responsive, issue1 + hot doc
11. CISO-to-CEO delay email ("wait before notifying") — issue2 + hot doc
12. Outside counsel legal advice on notification obligations — privileged
13. Mixed doc: incident timeline + embedded counsel advice — redact-privilege
14. Vendor invoice for forensic services — responsive, routine
15. Patient notification letter template with placeholder PHI — redact

**Generated volume (~385 docs):** deterministic PRNG generator (same pattern
as `buildCasepointVolume()` for the antitrust case) with weighted archetypes
(patient complaints, IT alerts, forensic status updates, HR lists, exec
strategy emails, press drafts, vendor traffic, personal noise). Each archetype
fixes a defensible answer **and** emits redaction spans, so every document is
fully gradeable including redactions. Same seed → same docs every load, so
progress keyed by doc ID stays stable.

## Multi-case Casepoint engine refactor

The current `cp*` engine is hardcoded to one case. Refactor to config-driven:

- `CP_CASES = { antitrust: {...}, breach: {...} }`. Each case config holds:
  `docs`, `breadcrumb`, `panelTitle`, `fields` (radio-group definitions:
  key, label, options with value/label), `issueTags` (multi-select
  definitions with colors), and a label map (replaces the hardcoded map in
  `cpLabel()`).
- `openCasepointCase(caseId)` sets `CP_ACTIVE`, renders the coding panel from
  config (the static panel HTML becomes a render function; antitrust output
  stays visually identical), and renders the doc list.
- State becomes per-case: `cpCoding[caseId][docId]`,
  `cpAnswered[caseId][docId]`. One-time migration moves existing flat `NS-*`
  keys into the `antitrust` bucket so no progress is lost.
- Other Projects page: antitrust card `onclick` becomes
  `openCasepointCase('antitrust')`; new Project 6 card (crimson/red accent,
  distinct from the blue antitrust card) with its own coded/accuracy counters.

## Click-to-redact mechanics

- Doc bodies embed span markers: `⟦PHI|Stage II lymphoma⟧`,
  `⟦PII|123-45-6789⟧`, `⟦SBI|$40M coverage cap⟧`, and decoys
  `⟦DECOY|Chief Medical Officer⟧`.
- At render, markers become clickable spans. Decoys are visually identical to
  real spans — no tell.
- Clicking a span opens a small popup to tag it **PII / PHI / SBI**. A tagged
  span renders as a black redaction box with a small reason chip. Clicking a
  redacted span un-redacts it.
- **Grading** (runs at Save Coding when the doc has answer spans): each answer
  span is *caught* (correct type), *mistyped* (redacted, wrong type), or
  *missed*; each redacted decoy is an *over-redaction*. The feedback overlay
  lists every miss/mistype/over-redaction alongside the coding-field results
  and the doc explanation.
- The antitrust case has no spans; its behavior is unchanged.

## Coding panel (breach case)

Same structure and scoring model as antitrust (5 graded fields + issue tags):

- RESPONSIVENESS: Responsive / Not Responsive / Technical Issue
- PRIVILEGE: Not Privileged / Privileged / Redact (Privilege)
- ISSUE TAGS: the four breach issues (multi-select)
- PRODUCTION: Produce / Withhold / Redact
- CONFIDENTIALITY: Confidential / Highly Confidential – AEO

Redaction score is reported alongside the 5-field coding score where spans
exist.

## Persistence

Pre-existing gap: `buildProgressData()` omits Casepoint state entirely, so
antitrust progress never persists. Fix as part of this work:

- Add `cp_coding` / `cp_answered` (per-case nested objects) to
  `buildProgressData()`, `applyProgressData()`, `saveProgressRemote()`,
  `loadProgressRemote()`.
- Supabase migration: add `cp_coding text` and `cp_answered text` columns to
  `reviewer_progress`. Required — a POST containing unknown columns fails and
  would silently break remote saves for rel/ev state too.

## Testing

No test framework in the repo; verification is browser-driven (Playwright):

1. Open the breach case from Other Projects; code a handwritten doc
   end-to-end including span redactions; verify grading (caught / missed /
   mistyped / over-redaction all exercised).
2. Switch to the antitrust case; confirm the panel, docs, and grading are
   unchanged and prior progress migrated.
3. Reload the page; confirm both cases' progress restores from localStorage,
   and (logged in) from Supabase.

## Out of scope

- Privilege-log (plog) integration for the breach case
- Batch system (`BATCH_SIZE`) integration for Casepoint
- Any changes to the Relativity/Everlaw engines
