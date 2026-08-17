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

Error density is per-project configuration, defaulting to 0.15. Fifteen percent is
realistic for a competent first-pass reviewer, and is high enough that a batch of 50 carries
enough errors to score meaningfully.

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

Over a batch, let:

- `S` = seeded errors, `w(e)` = severity weight of error `e`
- `caught` = errors identified **and** corrected to the right value
- `spotted` = errors identified but corrected to a *wrong* value (half credit)
- `clean` = documents with no seeded error
- `false_corrections` = clean documents the trainee changed

```
catch_rate       = ( Σ w(e) for caught  +  0.5 · Σ w(e) for spotted ) / Σ w(e) for S
false_corr_rate  = false_corrections / clean

accuracy = 100 × ( 0.60 · catch_rate
                 + 0.25 · (1 − false_corr_rate)
                 + 0.15 · family_agreement )
```

`family_agreement` is the consistency term defined in Component 4. It is folded in here
rather than given its own pillar, for the reason set out under *Goal*.

Escalation folds in as follows:

- Escalating an `ambiguous` document — counts as `caught`
- Failing to escalate an `ambiguous` document — counts as a miss
- Escalating a clear document — counts as a false correction at 0.5 weight

All weights and the 0.70/0.30 split are constants in one config object, tunable without
touching scoring logic.

---

## Component 2 — Pace clock

Every batch is timed, with a live docs/hr readout against the project's target.

**Pace is never scored alone.** It is reported as *sustainable pace* — throughput
discounted by how far accuracy fell below the project threshold:

```
effective_pace = achieved_docs_per_hour × min(1, accuracy / accuracy_threshold)²
pace_pillar    = 100 × min(1.25, effective_pace / target_pace)
```

The square is deliberate. Accuracy at 80% of threshold costs you 36% of your pace score,
not 20%. That is "speed without sacrificing accuracy" expressed as a number a person can
chase, and it makes racing through a batch strictly worse than working it properly. The
1.25 cap means exceeding the bar is rewarded but not unboundedly.

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

`family_agreement` feeds the **Accuracy** pillar at a 0.15 weight, per Component 1. It is
also stored on its own in `qc_attempts.consistency` and surfaced as a named sub-metric on
the Accuracy dial's detail view, so a person whose accuracy is being dragged down by
inconsistency can see that specifically rather than guessing.

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
| Accuracy | Catch rate, false-correction rate, family agreement | Supervisor-logged QC error rate |
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
  target_pace_docs_per_hour numeric not null,
  accuracy_threshold        numeric not null,      -- 0–100
  response_window_minutes   int     not null,
  error_density             numeric not null default 0.15,
  active                    boolean not null default true,
  updated_at                timestamptz not null default now()
);

create table public.qc_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_email     text not null,
  case_key       text not null references public.qc_projects(case_key),
  batch_no       int  not null,
  seed           text not null,
  started_at     timestamptz not null,
  completed_at   timestamptz,
  docs_reviewed  int not null default 0,
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
two-sided severity-weighted scoring, batch-complete review screen, error taxonomy reference.
Two cases: **Joba v. Bukando** (55 docs) as the on-ramp, since the team already knows it, and
**TransRidge v. Cascade Headwaters** (~500 docs) for volume — it is privilege-heavy, which
is where the severe errors live. Trains accuracy, judgment, attention to detail and pattern
recognition. No new tables; results persist through the existing progress mechanism.

**Phase 2 — Conditions.** Pace clock and sustainable-pace scoring, the three interrupt
types, near-duplicate seeding and consistency scoring, `qc_projects` config and its
leadership editor. Rolls across the remaining cases. Requires the real per-project numbers.

**Phase 3 — The loop.** `qc_attempts` and `qc_readiness` tables with RLS, the weekly
supervisor form, the five-pillar scorecard, leadership roster, status ladder, and the
simulation/live weighting.

## Inputs needed

Per project, for Phase 2 — Phase 1 is not blocked on these:

- Target pace, documents per hour
- Accuracy threshold, percent
- Expected response window, minutes
- Whether observed first-pass error rate differs materially from the 0.15 default

## Risks

- **Supervisor entry fatigue.** The most likely failure. Mitigated by the sixty-second
  constraint, permitted blank fields, and Phase 3 landing last, after the training half has
  already proved useful on its own.
- **Generated errors feeling artificial.** If seeded errors are too easy to spot the drill
  teaches nothing. Mitigated by frequency-weighted error selection and by reviewing the
  first batches against real QC findings, adjusting the mix.
- **`index.html` is already ~2.2MB.** QC Track adds meaningful code to a single file. Kept
  in one clearly delimited `// ══ QC TRACK` section with its own state object, following the
  existing sectioning convention, and no changes to existing simulator internals beyond
  reusing their render helpers.
- **Scorecard read as surveillance.** Mitigated by full individual visibility, by leading
  with training in Phase 1, and by presenting readiness as a gap-to-bar with a recommended
  next drill rather than as a ranking.
