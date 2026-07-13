# First Amendment Privilege Project — Casepoint Case (500 docs)

**Date:** 2026-07-13
**Status:** Approved

## Purpose

Add a third Casepoint simulator case to AA Mastery that trains paralegals on the
**First Amendment privilege** — a *qualified* privilege protecting associational and
expressive activity from compelled disclosure. The core lesson: reviewers must not
assume the privilege applies to politics/advocacy material; they **flag and escalate**
per protocol, because a court applies a balancing test (requesting party's need,
relevance, alternative sources, chilling effect).

## The Case

**TransRidge Pipeline LLC v. Cascade Headwaters Alliance** — a pipeline developer sues
an environmental advocacy nonprofit for tortious interference and trespass arising from
a protest campaign against the pipeline. Reviewers work for **defendant Cascade
Headwaters Alliance**, reviewing the nonprofit's own documents against plaintiff's
discovery requests, which seek:

1. Names and contact information of all members and volunteers.
2. Donor identities and contribution records.
3. Internal communications discussing protest strategy and organizing.
4. Documents concerning the alleged trespass / property-damage incidents.

## Where It Lives

- New entry `CP_CASES.firstam` in the existing Casepoint engine (`index.html`,
  Casepoint section starting ~line 5347). The engine is fully case-driven; no engine
  changes are expected beyond the new case object and dataset.
- New dataset `FA_DOCS` (IDs `FA-0001` … `FA-0500`), built the same way as `SAH_DOCS`:
  ~15 hand-authored teaching documents, then a seeded procedural generator producing
  docs 16–500 from ~10 weighted archetypes (`rngFor`/`pick`/weighted-pool pattern
  already in the file).
- New project card on the **Other Projects** page (`#page-other-projects`), styled like
  the antitrust and St. Aurelius cards: forest-green accent theme, 🌲/⛰️ iconography,
  `onclick="openCasepointCase('firstam')"`, coded-count badge
  (`id="cp-proj-coded-firstam"`) updated wherever the existing `cp-proj-coded-*`
  counters are updated.
- Per-case coding/answer/redaction persistence (localStorage primary + Supabase
  secondary) comes for free: `cpCodingFor()`/`cpAnsweredFor()` key state by
  `CP_ACTIVE`.

## Coding Panel

Same shape as the breach case, with the Privilege field adapted:

| Field | Options |
|---|---|
| RESPONSIVENESS | Responsive / Not Responsive / Technical Issue |
| PRIVILEGE | Not Privileged / Privileged (Attorney-Client) / **First Amendment — Flag & Escalate** |
| PRODUCTION | Produce / Withhold / Redact |
| CONFIDENTIALITY | Confidential / Highly Conf. – AEO |

**Issue tags:**
- Issue 1: Membership & Donors (associational-privilege core) — green
- Issue 2: Protest Strategy & Organizing — gold
- Issue 3: Alleged Trespass / Property Damage — red
- Issue 4: Hot Doc

**Correct-coding doctrine encoded in answers:**
- Member/donor/strategy documents → Responsive, **First Amendment — Flag & Escalate**,
  Withhold (pending the court's balancing ruling), usually HC-AEO.
- Already-public material (published flyers, op-eds, press releases) → Responsive,
  **Not Privileged**, Produce — no chilling effect for public expression; flagging it
  is over-coding.
- Outside-counsel litigation advice → Privileged (A-C), Withhold — tests the
  absolute-vs-qualified distinction from the shared material.
- GC merely cc'd on logistics → Not Privileged (cc'ing a lawyer creates no privilege).
- Evidence of the alleged unlawful conduct (fence-cutting, equipment tampering
  discussions) → Responsive, Not Privileged, Produce — the First Amendment does not
  shield evidence of unlawful acts, even inside an advocacy org.
- Junk/newsletters → Not Responsive, Withhold. Corrupted files → Technical Issue.
- Docs with volunteer PII (home addresses, phone numbers) → Redact (PII markers use
  the existing `⟦PII|…⟧` redaction syntax).

## Hand-Authored Teaching Docs (~15)

Each with `answer` + `explanation` reinforcing: qualified not absolute; balancing test;
flag, don't assume. Planned set:

1. Review-protocol memo from outside counsel explaining the FA-privilege protocol
   (itself A-C privileged — teaches the doctrine in-world).
2. Full membership roster spreadsheet (NAACP v. Alabama analogue) — flag & escalate.
3. Major-donor list with amounts — flag & escalate.
4. Internal email planning a lawful protest (site, signs, chants) — flag & escalate.
5. Published rally flyer / public Facebook event — produce (distractor: public).
6. Published op-ed by the executive director — produce (distractor: public).
7. Outside-counsel memo on litigation strategy — A-C privileged withhold.
8. Logistics email with GC cc'd, no advice sought — not privileged, produce.
9. Hot doc: organizer describes cutting a fence at the pipeline site — produce (Issue 3
   + Hot Doc; FA does not protect unlawful conduct).
10. Volunteer sign-in sheet with home addresses/phones — flag & escalate + PII redact
    training.
11. Coalition-partner strategy email (other orgs' identities) — flag & escalate.
12. Grant application to a foundation (public-facing budget) — produce.
13. Personal email (unrelated) — not responsive.
14. Corrupted/encrypted archive — technical issue.
15. Media inquiry + draft response — produce (press activity ≠ automatic privilege).

## Generated Archetypes (docs 16–500)

Weighted pool mirroring the SAH generator, roughly:

- Member communications / welcome emails (flag & escalate) — w:9
- Donor acknowledgments & pledge records (flag & escalate) — w:8
- Protest strategy / organizing threads (flag & escalate) — w:9
- Public communications: press releases, published posts (produce; distractor) — w:7
- A-C privileged counsel updates (withhold) — w:6
- Trespass-adjacent operational docs: site maps, incident chatter (produce) — w:6
- Vendor invoices (printing, buses, supplies) (produce) — w:5
- Junk/newsletter/personal noise (not responsive) — w:5
- Corrupted files (technical) — w:3

Generator constraints (same as SAH): seeded `rngFor(n * <prime> + k)` so output is
deterministic across sessions; custodians drawn from ~5 fictional org custodians
(Exec Director, Organizing Director, Development/Fundraising, Volunteer Coordinator,
Office of GC/outside counsel contact).

## Non-Goals

- No engine changes to Casepoint rendering, grading, or persistence.
- No new Supabase tables; existing progress sync handles the new case key.
- No changes to the Relativity/Everlaw simulators or nav structure (the case is
  launched from the existing Other Projects page).
- The doctrinal explainer lives in-world (protocol memo, card copy, explanations) —
  no new reference page.

## Testing / Verification

- Open the card from Other Projects; confirm 500 docs list, coding round-trips,
  correct-answer grading and explanations render, redaction markers work on the PII
  docs, coded-count badge updates, and state survives reload (localStorage) and
  login sync (Supabase).
- Confirm `esc()`/`escAttr()` wrap all dynamic content (existing engine already does
  this; new data must not bypass it).
- Note: CLAUDE.md's "duplicate DOCTYPE at ~5453" warning is stale — the file is now
  7,375 lines with a single DOCTYPE. New code appends within the existing Casepoint
  section following the `SAH_DOCS` / `CP_CASES.breach` pattern.
