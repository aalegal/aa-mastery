# QC Track — Design

**Date:** 2026-08-17
**Status:** Approved for planning

## Problem

AA reviewers are placed on live client projects. On some of those projects the client
eventually recognises a reviewer as strong enough to move onto the QC team. Too few of
our people reach that point, and we have no way to see who is close, who is not, or why.

"Hitting QC" is a status the *client* confers, not one we award. A client watches a
reviewer on live work and promotes them when they are satisfied on five counts:

| Client's criterion | Pillar |
| --- | --- |
| Quality / accuracy | Accuracy |
| Required pace or above | Pace |
| Responsiveness | Responsiveness |
| Reliability | Reliability |
| Understanding and application of project instructions | Judgment |

AA Mastery today teaches document review. It does not train against these five together,
and it measures none of them. QC appears in the app only as quiz trivia and playbook
prose — 29 textual mentions, no practice.

## Goal

A dedicated QC Track that trains people under the conditions the client is judging them
under, scores them on the same five pillars the client uses, and combines that score with
their live-project performance into one readiness picture the person can see and act on.

### A note on two words that are not synonyms

The original framing listed **Consistency**; the client's criteria list **Reliability**.
These are different traits and need different mechanisms:

- **Consistency** — coding the same way across similar documents. A judgment trait,
  trainable and measurable in simulation.
- **Reliability** — showing up, holding hours, sustained output, meeting deadlines. A
  dependability trait, only observable on real work.

Both are required to hit QC, and neither gets its own dial — the five pillars stay fixed to
the client's five criteria, because that framing is the point of the program. Instead:

- **Consistency** is measured in the simulator and folds into **Accuracy**. This is the
  honest placement: from the client's side, a reviewer who codes near-duplicates
  differently has an accuracy problem, and inconsistency is already one of the eight seeded
  error types.
- **Performance drift** across batches folds into **Reliability**, alongside the pace curve
  and the live data. Whether someone holds a standard over time is a dependability question.
- **Reliability** is otherwise scored from live data and the existing `timesheets` table.

## Non-goals

- Not a replacement for the existing review simulators. QC Track sits alongside them and
  assumes first-pass competence.
- Not a staffing or HR system. Readiness informs a conversation; it does not assign work.
- Not a live-project tool. No client documents ever enter this app.
- Phase 1 does not attempt the live-data loop. It ships as pure training.

## Calibration

Supplied from live projects, 2026-08-17. These are the defaults seeded into
`qc_projects`; per-project rows override them.

| Setting | Value | Note |
| --- | --- | --- |
| Accuracy target | **100%** | The stated goal. Not aspirational framing — it is the bar. |
| Accuracy tolerance | **1 error per 1,000 documents** | "Not too bad." Treated as the pass line. |
| Target pace | **60 docs/hr** | One document per minute, sustained. |
| Response window | **2 minutes** | Time to acknowledge a PM. |

Two consequences run through the whole design.

**The unit of accuracy is errors per 1,000 documents, not percent.** A 92% score reads as a
good grade and is, against this bar, a disaster — 80 errors per 1,000. Every accuracy number
a trainee sees is therefore expressed in the same unit the client uses to judge them. This
is the single most important calibration decision in the spec.

**Pace and responsiveness are in direct tension, deliberately.** 60 docs/hr is one document
per minute; a 2-minute response window is two documents' worth of work. Answering a PM
costs pace, visibly, and the drill does not hide that. Holding both at once is the skill
being trained.

## Architecture

A new page, `qc`, registered in `nav(p)` alongside the existing fifteen. Five sub-views:

1. **Track home** — five pillar dials, status ladder, next recommended drill
2. **Drill launcher** — choose case and batch
3. **QC review shell** — the drill itself, reusing the existing three-panel layout
4. **Error taxonomy** — reference content, also the source of in-drill explanations
5. **Leadership** — roster view and the weekly entry form (gated by `isLeadership()`)

Everything follows existing conventions: single-file `index.html`, no build step, `esc()` /
`escAttr()` on all dynamic content, `SB.*` for Supabase access, dark theme tokens from
`:root`.

---

## Component 1 — The QC Review Engine

The trainee does not code a blank document. They review a document **a prior reviewer has
already coded**, and decide whether that reviewer got it right.

### Generating the prior coding

Every document in the corpus already carries ground truth:

```js
answer: { responsive, privilege, issues[], action, conf }
explanation: "Responsive to Issues 1 and 2. Bukando's admission that…"
```

There are roughly 2,500 such documents across eight case sets (1,620 confirmed in the
`JSON.parse` sets — `REL_DOCS` 55, `CASE2_DOCS` 55, `P3_DOCS` 510, `P4_DOCS` 500,
`PTBR_DOCS` 500 — plus `CP_DOCS`, `SAH_DOCS` and `FA_DOCS` as array literals, `FA_DOCS`
carrying ~500). All share the same shape.

The prior coding is therefore *computed*, not authored: a generator takes `doc.answer` and
either passes it through unchanged or mutates it into a plausible error.

The generator is seeded from `hash(user_email + case_key + batch_no)`. This matters for
three reasons: a batch is reproducible, so a person can review their own mistakes against
the same data; two people can be given the identical batch for fair comparison; and nobody
can reroll for an easier draw.

### Two error densities, for two different jobs

Error density is per-project configuration, and it takes **two** values, because practice
and certification are training opposite things.

| Batch type | Density | Size | Purpose |
| --- | --- | --- | --- |
| **Practice** | 0.15 | 50 docs | Dense enough to teach. ~7–8 errors per batch, enough signal to learn each error type and to score a short session meaningfully. |
| **Certification** | 0.02 | 250 docs | Realistic. ~5 errors buried in 245 clean documents. |

The certification density is the important one, and it follows directly from the 1-in-1,000
tolerance. On a live project **almost every document a QC reviewer opens is fine.** That is
exactly why rubber-stamping happens: it is a rational response to a stream where the base
rate of error is near zero, and it is invisibly correct 98% of the time. Vigilance under
near-zero signal is the skill that separates someone the client keeps on QC from someone
they quietly move off it.

A drill packed with 15% errors cannot train that. It teaches error-spotting under
artificially rich conditions and, worse, primes the expectation that errors are common —
which is what produces the over-corrector. So practice is dense, certification is sparse,
and only the certification batch counts toward the Accuracy pillar.

Both values are per-project config. If observed first-pass error rates differ from these,
they are one row change and no code change.

### Error taxonomy

Eight error types, each with a severity weight used in scoring:

| Error type | Weight | What it looks like |
| --- | --- | --- |
| Missed privilege | 5 | Privileged document coded not-privileged. Causes clawbacks. |
| Over-privilege | 3 | Clean document withheld. Delays production, invites a challenge. |
| Under-designation | 3 | Responsive material coded non-responsive. Material never produced. |
| Instruction-drift | 3 | Coded per the old protocol after a mid-batch change. |
| Over-designation | 2 | Non-responsive coded responsive. The most common real finding. |
| Confidentiality mis-designation | 2 | Wrong confidentiality tier. |
| Inconsistency | 2 | Near-duplicate coded differently from the rest of its family. |
| Wrong issue tags | 1 | Correct responsive call, wrong issue codes. |

The generator picks an error type weighted by real-world frequency, not uniformly:
over-designation is common, missed privilege is rare and severe. It only applies an error
type the document can actually carry — it will not seed "missed privilege" on a document
whose ground truth is not privileged.

### The trainee's three moves

- **Agree** — the prior coding is correct as it stands
- **Correct** — it is wrong; supply the right coding via the existing coding panel
- **Escalate** — this is a genuine close call that should go up, not be quietly changed

Documents flagged `ambiguous: true` are the escalation targets. In `FA_DOCS` these already
exist — any document whose `answer.privilege` is `fa-flag` (Flag & Escalate). For other
cases the track carries a per-case array of document IDs, `QC_AMBIGUOUS[case_key] = [...]`,
selected by hand from documents whose `explanation` already reads as a close call. Roughly
5% of a batch should be genuinely ambiguous; more than that and escalation stops being a
judgment call and becomes the safe default.

### Scoring — two-sided

This is the load-bearing decision in the whole design.

A one-sided "how many errors did you find" score actively trains a second failure mode: the
reviewer who changes everything, destabilises the set, and burns the team's time.
Rubber-stamping and over-correcting both get people quietly removed from QC on live
projects. Both are scored here.

Scoring is **per document**, not per seeded error, so that the number produced is directly
comparable to the standard the client applies. A document is *handled correctly* when:

- it carried an error and was corrected to the right value, or
- it was clean and was agreed with, or
- it was `ambiguous` and was escalated

Anything else is a **defect**:

| Defect | Weight | |
| --- | --- | --- |
| Miss | `w(e)` | Agreed with a seeded error. The rubber-stamp. |
| Bad fix | `w(e) / 2` | Spotted the error, corrected it to the wrong value. |
| False correction | severity of the field changed, default 2 | Changed a clean document. |
| Missed escalation | 2 | Silently resolved a genuine close call. |
| Over-escalation | 1 | Escalated something clear. Wastes supervisor time. |

Defect units are normalised against weight 2 — the modal severity — so a missed privilege
(`w=5`) counts as 2.5 defects and a wrong issue tag (`w=1`) counts as 0.5:

```
defects       = Σ w(d) / 2
defect_rate   = 1000 × defects / documents_reviewed      // defects per 1,000 documents
```

### The denominator is literally 1,000 documents

The Accuracy pillar is computed over a **rolling window of the last 1,000 certification
documents** — four 250-document batches. This is not a smoothing convenience. It makes the
pillar the client's own metric with no rescaling: "errors per 1,000 documents" means exactly
that.

It also fixes a real problem. At a 1-in-1,000 tolerance, a single defect in one 250-document
batch is already four times the bar, so single-batch scoring would swing wildly between
perfect and failing on one slip. A person needs to demonstrate the standard *sustained*,
which is also what the client is actually observing.

Until 1,000 certification documents exist, the pillar reports over whatever is complete and
is labelled with its true denominator — "3 defects in 500 documents so far".

**Certification draws across cases, not within one.** A full window is 1,000 *unique*
documents, and no single case set holds that many — TransRidge has ~500, which is two
non-overlapping certification batches. Re-serving a document a person has already reviewed
compromises the measurement even under a fresh error seed, because they remember the
document. The certification pool is therefore drawn across all large case sets
(`P3_DOCS` 510, `P4_DOCS` 500, `PTBR_DOCS` 500, `FA_DOCS` ~500 — about 2,000 documents),
which is also closer to the truth: a QC reviewer works more than one matter.

This has a sequencing consequence. Phase 1 ships with TransRidge as the only certification
case, so the window caps at 500 documents and the pillar is labelled accordingly. The full
1,000-document window becomes available in Phase 2, when the remaining cases come online.

### Mapping to the dial

Piecewise linear between anchors. These are a calibration choice, held in one table and
tunable without touching scoring logic:

| Defects per 1,000 | Pillar |
| --- | --- |
| 0 | 100 |
| 1 | 95 |
| 2 | 90 |
| 5 | 78 |
| 10 | 60 |
| 20 | 35 |
| 40 | 10 |
| 60+ | 0 |

The QC-Ready floor of Accuracy ≥ 90 therefore means **no worse than 2 defects per 1,000
documents**, severity-weighted — the stated tolerance, with a little room for a single
low-severity slip.

### Diagnostics beneath the headline

`catch_rate`, `false_correction_rate` and `family_agreement` are still computed and shown,
but as *diagnostics* rather than as the score. They answer "why is my defect rate what it
is" — am I rubber-stamping, over-correcting, or coding near-duplicates inconsistently.
`family_agreement` is the consistency term from Component 4, folded in here rather than
given its own pillar, for the reason set out under *Goal*.

Escalation folds in as follows:

- Escalating an `ambiguous` document — counts as `caught`
- Failing to escalate an `ambiguous` document — counts as a miss
- Escalating a clear document — counts as a false correction at 0.5 weight

All weights and the 0.70/0.30 split are constants in one config object, tunable without
touching scoring logic.

---

## Component 2 — Pace clock

Every batch is timed, with a live docs/hr readout against the project's target.

**Pace is never scored alone.** It is reported as *sustainable pace* — throughput discounted
by the quality it was achieved at:

```
quality_factor = (accuracy_pillar / 100)²
effective_pace = achieved_docs_per_hour × quality_factor
pace_pillar    = 100 × min(1.25, effective_pace / 60)          // 60 docs/hr target
```

The square is deliberate. At an Accuracy pillar of 90 — already at the tolerance limit — a
reviewer keeps only 81% of their throughput. Someone racing at 75 docs/hr with an Accuracy
pillar of 60 books an effective 27 docs/hr and scores 45, well below someone working
carefully at target. That is "speed without sacrificing accuracy" expressed as a number a
person can chase, and it makes rushing a batch strictly worse than working it properly.

The 1.25 cap means beating 60 docs/hr is rewarded, but only to a point — nobody should be
optimising past the pace bar at the expense of the accuracy bar, which is the one the client
will not bend on.

The batch also records a **pace curve** — throughput across first, middle and final thirds.
A fast start that fades is a reliability signal and feeds that pillar.

---

## Component 3 — Mid-batch interrupts

The responsiveness mechanic, and the sharpest drill in the program. An in-sim inbox
delivers messages while the clock runs. Three kinds:

1. **Acknowledge** — "Confirm receipt." Scores time-to-acknowledge against the project's
   response window.
2. **Instruction change** — "Client has revised the privilege call on Category 3: vendor
   communications with outside counsel copied are now privileged. Apply going forward."
   Every document after that point is scored against the **new** rule, and the generator
   seeds instruction-drift errors accordingly.
3. **Feedback on their own work** — "You over-designated on Issue 2 last batch." Scored by
   whether that specific error type's miss rate drops in the following batch.

Type 2 is why this component exists. It measures responsiveness, careful reading of
instructions, and application of feedback as one observable act, rather than as three
things a supervisor lectures about and cannot verify.

Scoring, per interrupt `i` with response window `W`:

```
score_i = 1                      if ack ≤ W
        = 1 − (ack − W) / (2W)   if W < ack ≤ 3W
        = 0                      if ack > 3W or never acknowledged

responsiveness = 100 × mean(score_i)
```

At the calibrated `W` of **2 minutes**, that means full credit inside two minutes, partial
credit decaying to nothing at six, and zero thereafter. Two minutes is two documents' work
at target pace, so the drill has to make an arriving message genuinely noticeable — a
visible, persistent inbox state, not a subtle chime. Missing an interrupt should be a
decision, not an accident of the interface.

Interrupts fire at seeded positions in the batch, so timing is reproducible alongside the
document draw.

---

## Component 4 — Consistency and near-duplicates

Batches are seeded with near-duplicate families — threads, re-sends, attachment variants —
which is how real productions look. Families are generated from existing documents by
varying a subject line, adding a recipient, or re-sending; the ground-truth coding is
shared across the family.

```
family_agreement = families coded identically / families presented
```

Consistency reaches the Accuracy pillar through the defect count, not through a separate
weight: coding one member of a family differently from the rest *is* a defect, scored under
the Inconsistency error type at weight 2. `family_agreement` is kept as a **diagnostic** —
stored in `qc_attempts.consistency` and surfaced on the Accuracy dial's detail view — so a
person whose defect rate is being driven by inconsistency can see that specifically rather
than guessing at it.

A second measure, **drift**, tracks the stability of per-error-type accuracy across batches,
computed as `1 − normalised_stddev`. Drift feeds the **Reliability** pillar, not Accuracy —
holding a standard over time is a dependability question. It needs at least three completed
batches; until then Reliability reports on batch completion and pace-curve stability alone,
labelled as such.

---

## Component 5 — The readiness scorecard

Five dials, 0–100, each with the bar marked.

| Pillar | Simulation source | Live-project source |
| --- | --- | --- |
| Accuracy | Defects per 1,000 certification documents, rolling | Supervisor-logged QC error rate |
| Pace | Sustainable pace vs. target | Actual docs/hr from project reports |
| Responsiveness | In-sim acknowledgement times | Supervisor-logged response times |
| Judgment | Escalation calls, instruction-change application, correction quality | Supervisor rating on instruction application |
| Reliability | Batch completion, pace-curve stability, cross-batch drift | `timesheets` (already exists) plus deadline adherence |

### Judgment composition

```
judgment = 100 × ( 0.40 · escalation_accuracy
                 + 0.40 · post_change_compliance
                 + 0.20 · correction_quality )
```

where `correction_quality` is `caught / (caught + spotted)` — when they did decide something
was wrong, how often was their replacement coding right.

### Weighting

Until a person has four weeks of live entries, readiness is 100% simulation and is labelled
**"Simulation only"** on the dial. After that it shifts to **40% simulation / 60% live**.

The label is not decoration. A blended number that quietly hides "this is all practice"
would mislead the person and the supervisor at exactly the moment the number starts being
used for decisions.

### Composite

The composite is the **equal-weighted mean of the five pillars**. Equal weighting is
deliberate — the client is not trading these off against each other, and a weighting scheme
would encode a guess about their relative importance that we have no evidence for. Once
`QC-Recognized` outcomes accumulate, that guess can be replaced with a fitted one.

### Status ladder

- **Training** — composite below 70
- **Approaching** — composite ≥ 70
- **QC-Ready** — composite ≥ 85 **and** every pillar ≥ 75 **and** Accuracy ≥ 90
- **QC-Recognized** — set by leadership when a client actually promotes them

The per-pillar floor matters: the premise of the program is that hitting QC requires the
*combination*. Someone with excellent accuracy and no responsiveness does not get promoted
on live projects, and should not clear the bar here either.

The fourth rung closes the loop. Once a few dozen people have or have not been recognised,
"QC-Ready" can be checked against what actually happened and the thresholds moved. The
rubric stops being a guess and becomes a model that improves.

### Visibility

Each person sees their own five pillars, their gap to the bar, and what to practise next.
Leadership sees everyone. This is deliberate: the scorecard is a ladder people climb, not a
watchlist they are on, and self-correction is the fastest route to the bar.

---

## Component 6 — Supervisor weekly entry

The live half of this design dies if entry is a chore. Every "combine training with real
data" system that has failed, failed here.

Hard constraint: **one person, one week, five fields, under sixty seconds.** A roster of
names with inline inputs, not a CRUD app, not a modal per person.

Fields: QC error rate (%), docs/hr, average response time (minutes), instruction
application (1–5), reliability (1–5). One optional free-text note. Blank fields are
permitted and simply do not contribute that week.

---

## Data model

Three new tables. They follow the conventions established by `20260727_wellness_flags.sql`:
access is enforced in Postgres and never in the browser, and every policy keys on the JWT
email claim — never on `display_name`, which is user-settable metadata and therefore
spoofable.

`qc_readiness` holds performance data about identifiable employees in a **public
repository's** database. It is treated with the same care as the wellness data: nothing
about a named person is ever written into `index.html`, and the leadership email list lives
in the policy, not in the page.

```sql
create table public.qc_projects (
  case_key                  text primary key,      -- 'joba', 'firstam', …
  display_name              text not null,
  target_pace_docs_per_hour numeric not null default 60,
  max_defects_per_1000      numeric not null default 1,    -- the accuracy tolerance
  response_window_minutes   int     not null default 2,
  practice_density          numeric not null default 0.15,
  practice_batch_size       int     not null default 50,
  cert_density              numeric not null default 0.02,
  cert_batch_size           int     not null default 250,
  active                    boolean not null default true,
  updated_at                timestamptz not null default now()
);

create table public.qc_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_email     text not null,
  case_key       text not null references public.qc_projects(case_key),
  batch_no       int  not null,
  batch_type     text not null check (batch_type in ('practice','certification')),
  seed           text not null,
  started_at     timestamptz not null,
  completed_at   timestamptz,
  docs_reviewed  int not null default 0,
  defects        numeric,        -- severity-weighted, normalised to weight 2
  accuracy       numeric,
  pace           numeric,
  responsiveness numeric,
  judgment       numeric,
  consistency    numeric,
  reliability    numeric,
  detail         jsonb not null default '{}'::jsonb,  -- per-doc decisions, error breakdown
  created_at     timestamptz not null default now()
);

create table public.qc_readiness (
  id                  uuid primary key default gen_random_uuid(),
  user_email          text not null,
  week_ending         date not null,
  project             text,
  qc_error_rate       numeric,
  docs_per_hour       numeric,
  avg_response_minutes numeric,
  instruction_rating  int check (instruction_rating between 1 and 5),
  reliability_rating  int check (reliability_rating between 1 and 5),
  note                text check (note is null or length(note) <= 600),
  entered_by          text not null,
  created_at          timestamptz not null default now(),
  unique (user_email, week_ending, project)
);
```

RLS, in words — the migration writes these out in full:

- `qc_projects` — readable by any authenticated user; writable by leadership only.
- `qc_attempts` — a person inserts and reads only rows where `user_email` matches their JWT
  email. Leadership reads all. Nobody updates or deletes; a batch result is a record of what
  happened.
- `qc_readiness` — leadership inserts, updates and reads all. A person reads only their own
  rows, and cannot write them. Self-reported performance data would defeat the purpose.

Progress within an in-flight batch continues to use the existing localStorage-primary,
Supabase-secondary pattern in `saveProgress()`. A batch writes to `qc_attempts` on
completion only.

---

## UI

The QC review shell reuses the existing three-panel simulator layout:

- **Left** — document list, each row carrying a QC status chip: unreviewed / agreed /
  corrected / escalated
- **Centre** — document body, the existing viewer unchanged
- **Right** — two stacked cards. *Prior reviewer coding* (read-only, showing that
  reviewer's calls) and *Your QC decision* (Agree · Correct · Escalate). Choosing Correct
  expands the existing coding panel for the replacement values.
- **Top bar** — pace clock, live docs/hr against target, batch progress, and an inbox bell
  with an unread count for interrupts

The batch-complete screen shows the five pillar scores for that batch, every document the
trainee got wrong with the ground-truth `explanation` alongside their decision, and the
error types they are weakest on.

---

## Content to author

Three pieces need writing. Everything else is computed.

1. **Error taxonomy reference** — eight entries, each with a definition, why it matters on
   a live project, a worked example drawn from the corpus, and how to spot it. Doubles as
   in-drill explanation text. ~1,500 words.
2. **Project review protocols** — one readable protocol per case in the track, which the
   interrupts then amend. This is the largest lift and it is unavoidable: careful reading
   of instructions cannot be trained without instructions worth reading. ~800 words each.
   Partial material already exists — `FA-0001` is itself a review-protocol memo for the
   TransRidge case.
3. **Interrupt scripts** — six to eight messages per case, tied to that case's actual
   coding rules, across the three interrupt types.

---

## Phasing

Each phase ships something usable on the day it lands.

**Phase 1 — QC Review Engine.** Seeded error generator, agree/correct/escalate UI,
per-document defect scoring, batch-complete review screen, error taxonomy reference. Both
batch modes, and the `qc_projects` and `qc_attempts` tables with RLS — the rolling
1,000-document accuracy window needs durable storage, so these come in at the start rather
than being retrofitted.

Two cases, chosen to fit the two batch modes:

- **Joba v. Bukando** (55 docs) — *practice only*. The on-ramp: the team already knows the
  case, and 50-document practice batches fit it exactly. It cannot host certification, which
  needs 250.
- **TransRidge v. Cascade Headwaters** (~500 docs) — *practice and certification*. Large
  enough for 250-document batches, and privilege-heavy, which is where the severe defects
  live.

Ships as pure training: a person can drill, certify, and see their defect rate per 1,000.
Trains accuracy, judgment, attention to detail and pattern recognition.

**Phase 2 — Conditions.** Pace clock and sustainable-pace scoring, the three interrupt
types, near-duplicate seeding and the consistency diagnostic, and the leadership editor for
`qc_projects`. Rolls across the remaining cases — which also widens the pool of documents
large enough to certify against.

**Phase 3 — The loop.** `qc_readiness` with RLS, the weekly supervisor form, the five-pillar
scorecard, leadership roster, status ladder, and the simulation/live weighting.

## Inputs

Supplied 2026-08-17 and recorded under *Calibration*: 100% accuracy target with a 1-in-1,000
tolerance, 60 docs/hr, 2-minute response window. These become the `qc_projects` defaults.

Still open, and not blocking any phase:

- **Per-project overrides.** Whether any live project runs a different pace or response
  window from the defaults. Until told otherwise, every case inherits them.
- **Observed first-pass defect rate.** The `cert_density` of 0.02 is derived from the
  tolerance, not from measurement. If live QC findings show first-pass reviewers running
  materially above or below 2%, that is one config value and no code change.

## Risks

- **Supervisor entry fatigue.** The most likely failure. Mitigated by the sixty-second
  constraint, permitted blank fields, and Phase 3 landing last, after the training half has
  already proved useful on its own.
- **Generated errors feeling artificial.** If seeded errors are too easy to spot the drill
  teaches nothing. Mitigated by frequency-weighted error selection and by reviewing the
  first batches against real QC findings, adjusting the mix.
- **Certification is a real time cost.** 250 documents at 60 docs/hr is roughly four hours,
  and a full 1,000-document window is closer to seventeen. That is the honest price of
  measuring against a 1-in-1,000 standard — the bar cannot be demonstrated on a short
  sitting. Mitigated by making certification batches resumable across sittings, by keeping
  practice batches to 50 documents (~50 minutes), and by expecting the window to fill over
  weeks rather than in one push. If four hours proves unworkable in practice, the lever is
  `cert_batch_size`, at the cost of a noisier per-batch reading.
- **`index.html` is already ~2.2MB.** QC Track adds meaningful code to a single file. Kept
  in one clearly delimited `// ══ QC TRACK` section with its own state object, following the
  existing sectioning convention, and no changes to existing simulator internals beyond
  reusing their render helpers.
- **Scorecard read as surveillance.** Mitigated by full individual visibility, by leading
  with training in Phase 1, and by presenting readiness as a gap-to-bar with a recommended
  next drill rather than as a ranking.
