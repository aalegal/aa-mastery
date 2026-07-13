# First Amendment Privilege Casepoint Case — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 500-document First Amendment privilege review case (*TransRidge Pipeline LLC v. Cascade Headwaters Alliance*) to the existing Casepoint simulator, launched from the Other Projects page.

**Architecture:** Everything lives in `index.html` (single-file app, no build step). We add: (1) a `FA_DOCS` dataset — 15 hand-authored teaching docs plus a seeded procedural generator producing docs 16–500 — following the exact `SAH_DOCS` pattern; (2) a `CP_CASES.firstam` case object (the Casepoint engine is fully case-driven, no engine changes); (3) a project card on the Other Projects page. Coding persistence is automatic: `cpCodingFor()`/`cpAnsweredFor()` key state by `CP_ACTIVE`, and `cpUpdateLanding()` iterates `Object.keys(CP_CASES)`.

**Tech Stack:** Vanilla JS inside `index.html`. No test framework exists — verification uses `node -e` scripts that extract the FA data section between marker comments and eval it, plus Playwright MCP browser checks at the end.

**Spec:** `docs/superpowers/specs/2026-07-13-first-amendment-casepoint-design.md`

## Global Constraints

- Single file: all code goes in `index.html`. No new JS files, no npm, no build step.
- All dynamic DOM content must flow through the existing `esc(v)` / `escAttr(v)` helpers. The Casepoint engine already does this — the new data must not introduce any new `innerHTML` paths.
- Doc IDs: `FA-0001` … `FA-0500` (four digits, zero-padded).
- Coding field values (must match exactly everywhere): responsiveness `responsive | non-responsive | technical`; privilege `not-privileged | privileged | fa-flag`; production `produce | withhold | redact`; confidentiality `confidential | hc-aeo`; issues `issue1 | issue2 | issue3 | issue4`.
- Case key: `firstam`. Card counter element IDs: `cp-proj-coded-firstam` and `cp-proj-acc-firstam` (the `cpUpdateLanding()` function derives these from the case key — they must match).
- Generator must be deterministic: seeded RNG only (`rngFor`), no `Date.now()`/`Math.random()`, so doc IDs and content are stable across page loads (progress is keyed by doc ID).
- Redaction span syntax in doc bodies: `⟦PII|…⟧` and `⟦DECOY|…⟧` (already parsed by `cpRenderBodyHtml`).
- Insertion anchor for all JS: immediately **before** the line `var CP_ACTIVE = 'antitrust';`, which directly follows the `CP_CASES.breach = {…};` block.
- Marker comments `// FA-DATA-START`, `// FA-DATA-END`, `// FA-CASE-END` delimit the new section — the verification scripts extract by these markers. Do not remove them.
- Run all commands from the repo root: `/Users/jeff/Documents copy/aa-mastery` (note: NOT `~/Documents/aa-mastery`, which is iCloud-broken and unreadable).

---

### Task 1: Hand-authored teaching documents (`FA_DOCS`, docs 1–15)

**Files:**
- Modify: `index.html` — insert new section before `var CP_ACTIVE = 'antitrust';`

**Interfaces:**
- Consumes: nothing (self-contained data).
- Produces: global `var FA_DOCS` — array of doc objects `{id, type, custodian, tags, from, to, cc, date, subject, body, answer:{responsive, privilege, action, conf, issues}, explanation}`. Task 2 appends to this array; Task 3 references it as `CP_CASES.firstam.docs`.

- [ ] **Step 1: Write the failing verification check**

Run this from the repo root. It extracts the FA data section by markers and validates the hand-authored docs:

```bash
node -e '
const fs = require("fs");
const html = fs.readFileSync("index.html","utf8");
const m = html.match(/\/\/ FA-DATA-START([\s\S]*?)\/\/ FA-DATA-END/);
if (!m) { console.error("FAIL: FA data section not found"); process.exit(1); }
eval(m[1]);
if (typeof FA_DOCS === "undefined") { console.error("FAIL: FA_DOCS not defined"); process.exit(1); }
if (FA_DOCS.length !== 15) { console.error("FAIL: expected 15 docs, got " + FA_DOCS.length); process.exit(1); }
const RESP=["responsive","non-responsive","technical"], PRIV=["not-privileged","privileged","fa-flag"],
      ACT=["produce","withhold","redact"], CONF=["confidential","hc-aeo"], ISS=["issue1","issue2","issue3","issue4"];
for (const d of FA_DOCS) {
  if (!/^FA-\d{4}$/.test(d.id)) { console.error("FAIL: bad id " + d.id); process.exit(1); }
  const a = d.answer || {};
  if (!RESP.includes(a.responsive)) { console.error("FAIL: bad responsive on " + d.id); process.exit(1); }
  if (!PRIV.includes(a.privilege)) { console.error("FAIL: bad privilege on " + d.id); process.exit(1); }
  if (!ACT.includes(a.action)) { console.error("FAIL: bad action on " + d.id); process.exit(1); }
  if (!CONF.includes(a.conf)) { console.error("FAIL: bad conf on " + d.id); process.exit(1); }
  if (!Array.isArray(a.issues) || a.issues.some(i => !ISS.includes(i))) { console.error("FAIL: bad issues on " + d.id); process.exit(1); }
  if (JSON.stringify(a.issues) !== JSON.stringify(d.tags)) { console.error("FAIL: tags/answer.issues mismatch on " + d.id); process.exit(1); }
  if (!d.explanation || !d.subject || !d.custodian || !d.body) { console.error("FAIL: missing field on " + d.id); process.exit(1); }
}
console.log("PASS: 15 hand-authored FA docs valid");
'
```

- [ ] **Step 2: Run it — verify it fails**

Expected output: `FAIL: FA data section not found` with exit code 1.

- [ ] **Step 3: Insert the FA_DOCS section**

In `index.html`, find the line `var CP_ACTIVE = 'antitrust';` (it directly follows the closing `};` of the `CP_CASES.breach = {…}` block). Insert the following immediately **before** that line:

```javascript
// ══════════════════════════════════════════════════════════════════
// CASEPOINT — TRANSRIDGE PIPELINE v. CASCADE HEADWATERS ALLIANCE
// First Amendment privilege · membership / donor / strategy discovery
// FA-DATA-START (marker used by data checks — do not remove)
// ══════════════════════════════════════════════════════════════════
var FA_DOCS = [
  { id:"FA-0001", type:"memo", custodian:"cust-ed", tags:[],
    from:"Elena Vasquez <e.vasquez@riverastone.com>", to:"Maya Reyes (Exec. Dir.) <m.reyes@cascadehw.org>", cc:"",
    date:"April 7, 2025 · 9:15 AM", subject:"PRIVILEGED & CONFIDENTIAL — Review protocol: First Amendment privilege",
    body:"Maya,\n\nThis memo sets out the review protocol for TransRidge's document requests.\n\n1. The First Amendment privilege is QUALIFIED, not absolute. Do not assume a document is protected merely because it involves politics or advocacy. The court will balance TransRidge's need for the information, its relevance, the availability of other sources, and the chilling effect of disclosure on our members' associational rights.\n\n2. Documents revealing member identities, donor identities, or internal advocacy strategy should be coded 'First Amendment — Flag & Escalate' and withheld pending our motion for a protective order.\n\n3. Material the Alliance itself made public (flyers, published op-eds, press releases) is NOT protected — there is no chilling effect in producing what is already public.\n\n4. The privilege does not shield evidence of unlawful conduct. Documents concerning the alleged trespass incidents must be produced regardless of their political context.\n\nThis memo is attorney-client privileged.\n\nElena Vasquez\nRivera & Stone LLP",
    answer:{ responsive:"non-responsive", privilege:"privileged", action:"withhold", conf:"hc-aeo", issues:[] },
    explanation:"Outside counsel's advice to the client about how to conduct this review is attorney-client privileged and is not itself responsive to TransRidge's requests. Withhold. Note the protocol it teaches: the First Amendment privilege is qualified — flag and escalate, never assume it applies." },

  { id:"FA-0002", type:"file", custodian:"cust-vol", tags:["issue1"],
    from:"", to:"", cc:"",
    date:"March 3, 2025", subject:"CHA_member_roster_FY2025.xlsx (exported text)",
    body:"Cascade Headwaters Alliance — Member Roster (INTERNAL — DO NOT DISTRIBUTE)\n\nTotal active members: 4,812\n\nExtract (rows 1–8 of 4,812):\n1. Alan Pruitt — Bend, OR — member since 2019 — alan.pruitt@personalmail.com\n2. Dorothy Kim — Sisters, OR — member since 2021 — dkim88@personalmail.com\n3. Marcus Delgado — Redmond, OR — member since 2020 — mdelgado@personalmail.com\n4. Ruth Ann Foley — Prineville, OR — member since 2022 — rafoley@personalmail.com\n5. Gene Whitaker — Madras, OR — member since 2018 — gwhitaker@personalmail.com\n6. Tessa Nguyen — Bend, OR — member since 2023 — tnguyen@personalmail.com\n7. Carl Osborne — La Pine, OR — member since 2019 — cosborne@personalmail.com\n8. Ida Marsh — Bend, OR — member since 2024 — imarsh@personalmail.com\n\n[4,804 additional rows omitted from extract]",
    answer:{ responsive:"responsive", privilege:"fa-flag", action:"withhold", conf:"hc-aeo", issues:["issue1"] },
    explanation:"The complete membership roster is the classic associational-privilege document (the NAACP v. Alabama scenario): compelled disclosure of rank-and-file member identities chills freedom of association. Responsive to TransRidge's Request No. 1, but the privilege is qualified — code First Amendment — Flag & Escalate and withhold pending the court's balancing ruling. Do not assume the court will ultimately protect it." },

  { id:"FA-0003", type:"file", custodian:"cust-dev", tags:["issue1"],
    from:"", to:"", cc:"",
    date:"April 21, 2025", subject:"major_donor_pledges_FY2025.xlsx (exported text)",
    body:"Major Donor Pledges — FY2025 (DEVELOPMENT CONFIDENTIAL)\n\n1. Eleanor Voss — $50,000 — pledged, anonymity requested\n2. The Tamarack Family Trust — $35,000 — paid\n3. R. and P. Okafor — $20,000 — paid, anonymity requested\n4. Gene Whitaker — $10,000 — pledged\n5. Anonymous (wire ref 4471) — $25,000 — paid\n\nNote from P. Nair: several of these donors gave specifically on assurance their support would remain confidential given local tensions over the pipeline.",
    answer:{ responsive:"responsive", privilege:"fa-flag", action:"withhold", conf:"hc-aeo", issues:["issue1"] },
    explanation:"Donor identities — several with explicit anonymity requests tied to fear of local backlash — sit at the core of the qualified First Amendment privilege: disclosure would chill financial support for advocacy. Flag & Escalate, withhold pending the protective-order motion. The chilling-effect showing here is strong, but the balancing decision belongs to the court, not the reviewer." },

  { id:"FA-0004", type:"email", custodian:"cust-org", tags:["issue2"],
    from:"Ben Calloway (Organizing Dir.) <b.calloway@cascadehw.org>", to:"Organizing Team <organizing@cascadehw.org>", cc:"",
    date:"May 8, 2025 · 7:42 PM", subject:"Riverbend rally — plan and messaging",
    body:"Team,\n\nPlan for the May 17 rally:\n\n- Staging in the permitted area at Riverbend Park pavilion. Marshals in yellow vests; Sam has the sign-in table.\n- Message discipline: this is about the aquifer and eminent domain. Do not engage counter-protesters.\n- Sign-making party Thursday at the office. Chant sheet attached.\n- Carpools leave Bend Library at 10 AM.\n\nKeep this plan internal until the event — we do not want TransRidge's PR firm getting ahead of our framing.\n\nBen",
    answer:{ responsive:"responsive", privilege:"fa-flag", action:"withhold", conf:"hc-aeo", issues:["issue2"] },
    explanation:"Internal planning of a lawful, permitted protest is core protected expression and association. Responsive to the strategy request, but compelled disclosure of internal organizing plans to a litigation adversary would chill advocacy — Flag & Escalate and withhold pending the court's ruling." },

  { id:"FA-0005", type:"file", custodian:"cust-org", tags:["issue2"],
    from:"", to:"", cc:"",
    date:"May 9, 2025", subject:"riverbend_rally_flyer_FINAL.pdf (exported text)",
    body:"RALLY FOR THE RIVER!\n\nSaturday, May 17 · 11 AM · Riverbend Park Pavilion\n\nJoin your neighbors to say NO to the Cascade Ridge Pipeline.\n\nSpeakers · Live music · Family friendly\n\nBring a sign! Carpools leave Bend Library at 10 AM.\n\nPaid for by Cascade Headwaters Alliance — cascadehw.org\n\n[Distribution: posted publicly around Bend, Redmond, and Sisters; shared on public social media]",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:["issue2"] },
    explanation:"Distractor. The flyer is advocacy material, but the Alliance published it — posted around town and on public social media. There is no chilling effect in producing what is already public, so no First Amendment privilege claim. Flagging it would be over-coding. Produce as Confidential." },

  { id:"FA-0006", type:"file", custodian:"cust-ed", tags:["issue2"],
    from:"", to:"", cc:"",
    date:"April 12, 2025", subject:"gazette_oped_reyes_published_0412.pdf (exported text)",
    body:"[As published in the Deschutes Gazette, April 12, 2025 — Opinion]\n\nTHE PIPELINE OUR VALLEY CANNOT AFFORD\nBy Maya Reyes, Executive Director, Cascade Headwaters Alliance\n\nTransRidge tells us the Cascade Ridge Pipeline is inevitable. It is not. Our members — ranchers, teachers, retirees, small-business owners — have packed every county hearing because they understand what is at stake: the aquifer that supplies drinking water to forty thousand people.\n\nWe will keep showing up, keep speaking, and keep petitioning our government. That is not obstruction. That is citizenship.\n\n[End of published text]",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:["issue2"] },
    explanation:"A published op-ed is public expression — no confidentiality, no chilling effect, no privilege. Produce. The First Amendment protects the right to speak; it does not make the published speech itself immune from discovery." },

  { id:"FA-0007", type:"memo", custodian:"cust-ed", tags:["issue3"],
    from:"Elena Vasquez <e.vasquez@riverastone.com>", to:"Maya Reyes (Exec. Dir.) <m.reyes@cascadehw.org>", cc:"",
    date:"June 2, 2025 · 4:30 PM", subject:"PRIVILEGED & CONFIDENTIAL — Assessment of TransRidge's trespass and interference claims",
    body:"Maya,\n\nYou asked for our assessment of the claims. In brief:\n\n1. The tortious-interference count is weak — TransRidge must show improper means, and lawful protest and petitioning are protected activity.\n\n2. The trespass count is the real exposure. If TransRidge ties the May 17 gate incident to anyone acting on the Alliance's behalf, damages and an injunction against site access are realistic. Our advice is set out in section 3.\n\n3. Recommended posture: [detailed legal strategy follows].\n\nThis memo contains legal advice and is protected by the attorney-client privilege and work product doctrine.\n\nElena Vasquez\nRivera & Stone LLP",
    answer:{ responsive:"responsive", privilege:"privileged", action:"withhold", conf:"hc-aeo", issues:["issue3"] },
    explanation:"Legal advice from outside counsel to the client — attorney-client privileged, which (unlike the First Amendment privilege) is absolute when its elements are met, not subject to a balancing test. Code Privileged (Attorney-Client), not Flag & Escalate. Responsive to the trespass issue but withheld and logged." },

  { id:"FA-0008", type:"email", custodian:"cust-ops", tags:["issue2"],
    from:"Dana Whitfield (Operations Mgr.) <d.whitfield@cascadehw.org>", to:"High Desert Charters <bookings@highdesertcharters.com>", cc:"Elena Vasquez <e.vasquez@riverastone.com>",
    date:"May 12, 2025 · 10:05 AM", subject:"Bus rental — May 17 event",
    body:"Hi,\n\nConfirming two 44-passenger coaches for Saturday May 17: pickup 10 AM at Bend Library, drop at Riverbend Park, return 3 PM. Please send the certificate of insurance and invoice to accounts@cascadehw.org.\n\nI have cc'd our attorney so she stays in the loop on event logistics.\n\nThanks,\nDana",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:["issue2"] },
    explanation:"Two lessons in one document. Cc'ing a lawyer 'to stay in the loop' does not create attorney-client privilege — no legal advice is sought or given. And a routine commercial booking sent to an outside vendor is not confidential associational material, so there is no First Amendment claim either. Produce as Confidential." },

  { id:"FA-0009", type:"email", custodian:"cust-org", tags:["issue3","issue4"],
    from:"R. Teller <rteller.field@personalmail.com>", to:"Ben Calloway (Organizing Dir.) <b.calloway@cascadehw.org>", cc:"",
    date:"May 18, 2025 · 8:12 AM", subject:"last night at the compressor site",
    body:"Ben — heads up. After the rally a few of us went back out to the TransRidge staging yard. Someone in the group cut the chain on the equipment gate and pulled up about thirty survey stakes along the ridge line. I did not touch anything but I was there. People are going to ask questions.\n\n---\nReply from B. Calloway, May 18, 9:03 AM: Do NOT put any of this in writing again. Call me.",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:["issue3","issue4"] },
    explanation:"Hot document at the heart of TransRidge's trespass claim: a firsthand account of the gate-cutting and stake-pulling, plus an organizer's 'do not put this in writing' reply. The First Amendment does not shield evidence of unlawful conduct, even inside an advocacy organization. No lawyer involved, no privilege of any kind. Produce, and escalate per the hot-doc protocol." },

  { id:"FA-0010", type:"file", custodian:"cust-vol", tags:["issue1"],
    from:"", to:"", cc:"",
    date:"May 17, 2025", subject:"riverbend_signin_sheet.csv (exported text)",
    body:"Riverbend rally — volunteer sign-in (May 17)\n\n1. Tessa Nguyen — ⟦PII|541-555-0182⟧ — ⟦PII|2210 Juniper Ct, Bend OR⟧ — ⟦DECOY|shirt size M⟧\n2. Carl Osborne — ⟦PII|541-555-0147⟧ — ⟦PII|88 Obsidian Way, La Pine OR⟧ — marshal shift 11–1\n3. Ida Marsh — ⟦PII|541-555-0119⟧ — ⟦PII|415 Larkspur St, Bend OR⟧ — sign-in table\n\n[62 additional rows omitted from extract]",
    answer:{ responsive:"responsive", privilege:"fa-flag", action:"redact", conf:"hc-aeo", issues:["issue1"] },
    explanation:"Volunteer identities implicate the associational privilege — Flag & Escalate. This one also trains redaction: if the court orders production after balancing, the phone numbers and home addresses are PII to redact; shift assignments and shirt sizes are not protected, and redacting them would be over-redaction." },

  { id:"FA-0011", type:"email", custodian:"cust-ed", tags:["issue2"],
    from:"Maya Reyes (Exec. Dir.) <m.reyes@cascadehw.org>", to:"J. Whitehorse (Willamette Riverkeepers) <j.whitehorse@wriverkeepers.org>; T. Brandt (High Desert Land Trust) <t.brandt@hdlandtrust.org>", cc:"",
    date:"April 29, 2025 · 6:55 PM", subject:"Coalition strategy — phase 2 pressure campaign",
    body:"Friends,\n\nPhase 2 plan for coalition sign-off:\n\n1. Coordinated comment letters to the county commission ahead of the June land-use vote.\n2. Meetings with the two banks in TransRidge's project financing — quiet outreach first, public campaign only if they stonewall.\n3. Joint town hall in Redmond, late June.\n\nPlease keep your organizations' participation confidential until we launch — two of your boards have asked not to be named while their own funding conversations are pending.\n\nMaya",
    answer:{ responsive:"responsive", privilege:"fa-flag", action:"withhold", conf:"hc-aeo", issues:["issue2"] },
    explanation:"Confidential strategy shared among coalition partners — associational privilege covers collective advocacy planning, and the email itself records why disclosure chills association: partner boards asked not to be named. Flag & Escalate, withhold pending the court's balancing ruling." },

  { id:"FA-0012", type:"file", custodian:"cust-dev", tags:["issue1"],
    from:"", to:"", cc:"",
    date:"March 20, 2025", subject:"Meridian_Foundation_grant_application_FY25.pdf (exported text)",
    body:"GRANT APPLICATION — Meridian Foundation\n\nApplicant: Cascade Headwaters Alliance (EIN on file)\nRequest: $75,000 — Deschutes basin water-quality monitoring program\n\nProgram description: volunteer-led quarterly sampling at 22 river sites, lab analysis, and a public data dashboard.\n\nBudget summary: staff $41,000; lab fees $19,500; equipment $9,000; outreach $5,500.\n\nNote: per Meridian Foundation policy, all awarded grants are published in the Foundation's annual report.",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:["issue1"] },
    explanation:"Distractor on the donor issue. An institutional foundation grant is publicly reported — by the foundation itself and in the organization's Form 990 — so there is no anonymity interest and no chilling effect. Produce. The associational-privilege claim centers on individual members and donors who fear reprisal, not on public institutional funding." },

  { id:"FA-0013", type:"email", custodian:"cust-ed", tags:[],
    from:"Maya Reyes (Exec. Dir.) <m.reyes@cascadehw.org>", to:"Carmen Reyes <carmen.r@personalmail.com>", cc:"",
    date:"May 4, 2025 · 8:20 PM", subject:"Mom's birthday",
    body:"Car — I can do dinner Saturday but not before 7. Did you order the cake or am I doing it? Let's split whatever it costs. Also bring the photo albums, she asked about them again.\n\nM",
    answer:{ responsive:"non-responsive", privilege:"not-privileged", action:"withhold", conf:"confidential", issues:[] },
    explanation:"Purely personal family logistics with no connection to the pipeline, the campaign, or any discovery request. Not responsive; withhold. Sent from a work account, but content controls responsiveness — not the mailbox it came from." },

  { id:"FA-0014", type:"file", custodian:"cust-ops", tags:[],
    from:"", to:"", cc:"",
    date:"May 20, 2025", subject:"field_photos_2025_archive.zip (no text extracted)",
    body:"[This file could not be rendered for review. The archive failed text extraction and appears corrupted. Flag to the technical/processing team for re-collection.]",
    answer:{ responsive:"technical", privilege:"not-privileged", action:"withhold", conf:"confidential", issues:[] },
    explanation:"The file failed processing and cannot be reviewed. Code Responsiveness as Technical Issue and route for re-collection — never guess substantive coding for an unreadable file. Withhold pending a readable version." },

  { id:"FA-0015", type:"email", custodian:"cust-ed", tags:["issue2"],
    from:"Dana Brooks <dbrooks@deschutesgazette.com>", to:"Maya Reyes (Exec. Dir.) <m.reyes@cascadehw.org>", cc:"",
    date:"June 10, 2025 · 11:47 AM", subject:"Comment request — TransRidge lawsuit",
    body:"Ms. Reyes,\n\nI am writing a story on TransRidge's lawsuit against the Alliance. Can you comment on the trespass allegations and on the company's demand for your membership list? Deadline is Thursday noon.\n\nDana Brooks, Deschutes Gazette\n\n---\nReply from M. Reyes, June 10, 2:30 PM: On the record: 'TransRidge is using this lawsuit to unmask its critics. Courts have protected the privacy of advocacy organizations' members for seventy years, and we are confident they will here.' No comment on the specific allegations while litigation is pending.",
    answer:{ responsive:"responsive", privilege:"not-privileged", action:"produce", conf:"confidential", issues:["issue2"] },
    explanation:"Communications with a reporter and an on-the-record statement drafted for publication are outward-facing — not confidential associational material, and not legal advice. No privilege applies. Produce as Confidential." }
];
// FA-DATA-END (marker used by data checks — do not remove)
```

- [ ] **Step 4: Run the verification — verify it passes**

Run the same command as Step 1. Expected output: `PASS: 15 hand-authored FA docs valid`

- [ ] **Step 5: Sanity-check the page still loads**

```bash
python3 -m http.server 8000 &
sleep 1
curl -s http://localhost:8000/index.html | tail -c 200
kill %1
```

Expected: the tail of the HTML file prints (server works). Full browser check comes in Task 5.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(firstam): 15 hand-authored First Amendment teaching documents"
```

---

### Task 2: Procedural generator (docs 16–500)

**Files:**
- Modify: `index.html` — insert IIFE between the `FA_DOCS` closing `];` and the `// FA-DATA-END` marker

**Interfaces:**
- Consumes: `FA_DOCS` array from Task 1 (pushes onto it).
- Produces: `FA_DOCS` grown to exactly 500 docs with unique IDs `FA-0016`…`FA-0500`, same object shape as Task 1. Deterministic across page loads.

- [ ] **Step 1: Write the failing verification check**

```bash
node -e '
const fs = require("fs");
const html = fs.readFileSync("index.html","utf8");
const m = html.match(/\/\/ FA-DATA-START([\s\S]*?)\/\/ FA-DATA-END/);
if (!m) { console.error("FAIL: FA data section not found"); process.exit(1); }
eval(m[1]);
if (FA_DOCS.length !== 500) { console.error("FAIL: expected 500 docs, got " + FA_DOCS.length); process.exit(1); }
const ids = new Set(FA_DOCS.map(d => d.id));
if (ids.size !== 500) { console.error("FAIL: duplicate ids"); process.exit(1); }
for (let n = 1; n <= 500; n++) {
  if (!ids.has("FA-" + ("000"+n).slice(-4))) { console.error("FAIL: missing FA-" + ("000"+n).slice(-4)); process.exit(1); }
}
const RESP=["responsive","non-responsive","technical"], PRIV=["not-privileged","privileged","fa-flag"],
      ACT=["produce","withhold","redact"], CONF=["confidential","hc-aeo"], ISS=["issue1","issue2","issue3","issue4"];
const counts = { "fa-flag":0, "privileged":0, "non-responsive":0, "technical":0 };
for (const d of FA_DOCS) {
  const a = d.answer || {};
  if (!RESP.includes(a.responsive) || !PRIV.includes(a.privilege) || !ACT.includes(a.action) || !CONF.includes(a.conf)
      || !Array.isArray(a.issues) || a.issues.some(i => !ISS.includes(i))
      || JSON.stringify(a.issues) !== JSON.stringify(d.tags)
      || !d.explanation || !d.subject || !d.custodian || !d.body) {
    console.error("FAIL: invalid doc " + d.id); process.exit(1);
  }
  if (counts[a.privilege] !== undefined) counts[a.privilege]++;
  if (counts[a.responsive] !== undefined) counts[a.responsive]++;
}
if (counts["fa-flag"] < 150) { console.error("FAIL: too few fa-flag docs: " + counts["fa-flag"]); process.exit(1); }
if (counts["privileged"] < 30) { console.error("FAIL: too few privileged docs: " + counts["privileged"]); process.exit(1); }
if (counts["non-responsive"] < 20) { console.error("FAIL: too few non-responsive docs: " + counts["non-responsive"]); process.exit(1); }
if (counts["technical"] < 10) { console.error("FAIL: too few technical docs: " + counts["technical"]); process.exit(1); }
// Determinism: rebuild and compare.
const first = JSON.stringify(FA_DOCS.map(d => d.subject));
FA_DOCS = undefined; eval(m[1]);
if (JSON.stringify(FA_DOCS.map(d => d.subject)) !== first) { console.error("FAIL: generator not deterministic"); process.exit(1); }
console.log("PASS: 500 FA docs, unique deterministic ids, valid coding, mix ok");
'
```

- [ ] **Step 2: Run it — verify it fails**

Expected output: `FAIL: expected 500 docs, got 15` with exit code 1.

- [ ] **Step 3: Insert the generator IIFE**

In `index.html`, insert the following between the `];` that closes `FA_DOCS` and the `// FA-DATA-END` marker line:

```javascript
// ══════════════════════════════════════════════════════════════════════════
// Procedural volume: docs FA-0016 … FA-0500 from weighted archetypes.
// Seeded RNG (no Math.random/Date) so the same docs render every load —
// progress keyed by doc id stays stable.
// ══════════════════════════════════════════════════════════════════════════
(function buildFirstAmVolume(){
  function rngFor(seed){ var s=(seed>>>0)||1; return function(){ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
  function pick(r,a){ return a[Math.floor(r()*a.length)]; }

  var ROSTER = {
    'cust-ed':  {name:'Maya Reyes (Exec. Dir.)',          email:'m.reyes@cascadehw.org'},
    'cust-org': {name:'Ben Calloway (Organizing Dir.)',   email:'b.calloway@cascadehw.org'},
    'cust-dev': {name:'Priya Nair (Development Dir.)',    email:'p.nair@cascadehw.org'},
    'cust-vol': {name:'Sam Otieno (Volunteer Coord.)',    email:'s.otieno@cascadehw.org'},
    'cust-ops': {name:'Dana Whitfield (Operations Mgr.)', email:'d.whitfield@cascadehw.org'}
  };
  function person(cust){ var p=ROSTER[cust]; return p.name+' <'+p.email+'>'; }

  var PEOPLE = ['Alan Pruitt','Dorothy Kim','Marcus Delgado','Ruth Ann Foley','Gene Whitaker','Tessa Nguyen','Carl Osborne','Ida Marsh','Ray Bellamy','Nina Kowalski','Owen Tate','Lucia Fuentes'];
  var TOWNS = ['Bend, OR','Redmond, OR','Sisters, OR','Prineville, OR','Madras, OR','La Pine, OR'];
  var MONTHS = [['September',2024],['October',2024],['November',2024],['March',2025],['April',2025],['May',2025]];
  function dateStr(r){ var m=pick(r,MONTHS), day=1+Math.floor(r()*28), h=1+Math.floor(r()*12), mn=Math.floor(r()*60), ap=r()<0.5?'AM':'PM'; return m[0]+' '+day+', '+m[1]+' · '+h+':'+(mn<10?'0'+mn:mn)+' '+ap; }
  function fileDate(r){ var m=pick(r,MONTHS); return m[0]+' '+(1+Math.floor(r()*28))+', '+m[1]; }
  function money(r,lo,hi){ return '$'+(lo+Math.floor(r()*(hi-lo))).toLocaleString(); }
  function memberEmail(name){ return name.toLowerCase().replace(/[^a-z]/g,'')+'@personalmail.com'; }

  // Each archetype: weight w, eligible custodians, make(r,cust) returning
  // { type, subject, from, to, cc, body, issues, answer, explanation }.
  var A = [
    // Member communications — flag & escalate (w:9)
    { w:9, cust:['cust-vol','cust-dev'], make:function(r,cust){
        var name=pick(r,PEOPLE), town=pick(r,TOWNS);
        return { type:'email',
          subject:pick(r,['Welcome to Cascade Headwaters Alliance!','Your membership renewal','Member update — thank you','New member packet','Membership confirmation']),
          from:person(cust), to:name+' <'+memberEmail(name)+'>', cc:'',
          body:'Dear '+name+',\n\n'+pick(r,[
            'Welcome to the Alliance! Your membership is confirmed. You are member number '+(1000+Math.floor(r()*4000))+' — one of thousands of neighbors in '+town+' and across the basin standing up for our water.',
            'Thank you for renewing your membership. Your continued support from '+town+' keeps this campaign going.',
            'Your new-member packet is on its way to your address in '+town+'. Meanwhile, here is your member login for the volunteer portal.',
            'We have recorded your membership renewal. As always, we never share our member list with anyone.'])
            +'\n\nFor the river,\n'+ROSTER[cust].name.split(' (')[0],
          issues:['issue1'],
          answer:{ responsive:'responsive', privilege:'fa-flag', action:'withhold', conf:'hc-aeo', issues:['issue1'] },
          explanation:'This correspondence identifies an individual rank-and-file member — exactly what the associational privilege protects from compelled disclosure. Responsive to the membership request, but qualified privilege: Flag & Escalate and withhold pending the protective-order ruling.' };
      }},
    // Donor acknowledgments — flag & escalate (w:8)
    { w:8, cust:['cust-dev'], make:function(r,cust){
        var name=pick(r,PEOPLE);
        return { type:'email',
          subject:pick(r,['Thank you for your gift','Your donation receipt','Pledge confirmation','Year-end giving — thank you']),
          from:person(cust), to:name+' <'+memberEmail(name)+'>', cc:'',
          body:'Dear '+name+',\n\nThank you for your '+pick(r,['gift','pledge','contribution'])+' of '+money(r,50,5000)+' to Cascade Headwaters Alliance. '
            +pick(r,['Per your request, your support will be kept strictly confidential.','Your gift will fund the water-quality monitoring program.','This letter serves as your tax receipt; no goods or services were provided.','Your support makes the campaign against the Cascade Ridge Pipeline possible.'])
            +'\n\nWith gratitude,\nPriya Nair\nDevelopment Director',
          issues:['issue1'],
          answer:{ responsive:'responsive', privilege:'fa-flag', action:'withhold', conf:'hc-aeo', issues:['issue1'] },
          explanation:'A donor acknowledgment identifying an individual supporter and amount — compelled disclosure of donor identities chills financial support for advocacy. Qualified First Amendment privilege: Flag & Escalate, withhold pending the balancing ruling.' };
      }},
    // Protest strategy / organizing threads — flag & escalate (w:9)
    { w:9, cust:['cust-org','cust-ed'], make:function(r,cust){
        var rcv = cust==='cust-org' ? 'cust-ed' : 'cust-org';
        return { type:'email',
          subject:pick(r,['Canvass plan — west county','Phone bank script v'+(1+Math.floor(r()*4)),'Hearing turnout strategy','Volunteer captain assignments','Comment-letter campaign plan']),
          from:person(cust), to:person(rcv), cc:'',
          body:pick(r,[
            'Draft canvass plan attached: 40 volunteers, four precincts, focus on households near the proposed easement. Talking points emphasize the aquifer study.',
            'Phone bank script revised — leads with the eminent-domain angle, asks members to testify at the county hearing. Target: 600 calls this week.',
            'Turnout plan for the land-use hearing: members get first two rows, speakers rehearse Tuesday, yellow shirts for visibility. Do not share the speaker list outside the team.',
            'Volunteer captain assignments for the petition drive are attached. Captains coordinate their own crews; roster stays internal.',
            'Comment-letter campaign: template goes to members only, personalized letters beat form letters, deadline is the 21st.'])
            +'\n\nKeep internal.\n'+ROSTER[cust].name.split(' (')[0],
          issues:['issue2'],
          answer:{ responsive:'responsive', privilege:'fa-flag', action:'withhold', conf:'hc-aeo', issues:['issue2'] },
          explanation:'Internal advocacy strategy — organizing plans, targets, and volunteer assignments. Core protected association and expression; disclosure to a litigation adversary would chill organizing. Flag & Escalate and withhold pending the court ruling.' };
      }},
    // Public communications — produce (distractor) (w:7)
    { w:7, cust:['cust-ed','cust-org'], make:function(r,cust){
        return { type:'file',
          subject:pick(r,['press_release_'+pick(r,['hearing','rally','petition','lawsuit_response'])+'.pdf (exported text)','blog_post_published_'+(1+Math.floor(r()*28))+'.txt','public_facebook_event.txt (captured)','newsletter_public_edition.pdf (exported text)']),
          from:'', to:'', cc:'',
          body:'[PUBLISHED / PUBLICLY POSTED]\n\n'+pick(r,[
            'FOR IMMEDIATE RELEASE — Cascade Headwaters Alliance announced today that more than 3,000 residents have signed the petition opposing the Cascade Ridge Pipeline. "Our community has spoken," said Executive Director Maya Reyes.',
            'From the CHA public blog: What the aquifer study actually says — a plain-language summary of the hydrology report, and why the pipeline route puts drinking water at risk.',
            'PUBLIC EVENT — Rally for the River, Riverbend Park. All welcome. Speakers, live music, family friendly. Hosted by Cascade Headwaters Alliance.',
            'CHA Public Newsletter: hearing dates, how to submit a comment to the county commission, and volunteer opportunities. Forward to a friend!']),
          issues:['issue2'],
          answer:{ responsive:'responsive', privilege:'not-privileged', action:'produce', conf:'confidential', issues:['issue2'] },
          explanation:'Advocacy-related but PUBLISHED — the organization put this in the public domain itself, so compelled production creates no chilling effect and no First Amendment privilege applies. Flagging public material is over-coding. Produce as Confidential.' };
      }},
    // Counsel updates — A-C privileged withhold (w:6)
    { w:6, cust:['cust-ed'], make:function(r,cust){
        return { type:'memo',
          subject:'PRIVILEGED & CONFIDENTIAL — '+pick(r,['litigation status update','discovery strategy','protective order motion — draft outline','deposition preparation','response to TransRidge demand letter']),
          from:'Elena Vasquez <e.vasquez@riverastone.com>', to:person(cust), cc:'',
          body:'Maya,\n\n'+pick(r,[
            'Status update on the TransRidge matter: our motion for a protective order covering member and donor records is on track for filing this month. Our legal analysis of the balancing factors follows.',
            'Our advice on the pending document requests: objections to Requests 1 and 3 on First Amendment grounds, with the supporting declarations described below.',
            'In preparation for your deposition, we should discuss the topics below at our next privileged call. Please do not forward this memo.',
            'Our assessment of TransRidge’s settlement posture and our recommended response is set out below.'])
            +'\n\nThis communication contains legal advice and is protected by the attorney-client privilege.\n\nElena Vasquez\nRivera & Stone LLP',
          issues:['issue3'],
          answer:{ responsive:'responsive', privilege:'privileged', action:'withhold', conf:'hc-aeo', issues:['issue3'] },
          explanation:'Legal advice from outside counsel to the client about the litigation — attorney-client privileged. Unlike the qualified First Amendment privilege, A-C privilege is absolute when its elements are met. Code Privileged (Attorney-Client), withhold, and log.' };
      }},
    // Trespass-adjacent operational docs — produce (w:6)
    { w:6, cust:['cust-ops','cust-org'], make:function(r,cust){
        return { type:pick(r,['email','file']),
          subject:pick(r,['Site observation log — ridge segment','Incident report — confrontation at access road','Gate photos — staging yard fence line','Field notes — survey crew activity','Equipment yard observation notes']),
          from:person(cust), to:person(cust==='cust-ops'?'cust-org':'cust-ops'), cc:'',
          body:pick(r,[
            'Observation log: TransRidge survey crew active on the ridge segment 9 AM to 2 PM. All observations made from the public forest road. Photos attached.',
            'Incident report: verbal confrontation between two of our monitors and a TransRidge security contractor at the access road gate. No physical contact. Monitors reminded to stay on the public easement.',
            'Fence-line photos from Saturday attached. Note: the equipment gate chain appears to have been replaced since last week.',
            'Field notes: stake line now extends past the creek crossing. Flagging for the legal team — this may exceed the surveyed easement.',
            'Yard observation: three new excavators delivered. Monitoring shift schedule attached for next week.']),
          issues:['issue3'],
          answer:{ responsive:'responsive', privilege:'not-privileged', action:'produce', conf:'confidential', issues:['issue3'] },
          explanation:'Operational monitoring and incident documentation relating to the alleged trespass dispute — squarely responsive to Issue 3 and not privileged: it is factual observation, not confidential strategy or member identity, and the First Amendment does not shield evidence relevant to the conduct claims. Produce as Confidential.' };
      }},
    // Vendor invoices — produce (w:5)
    { w:5, cust:['cust-ops'], make:function(r,cust){
        return { type:'file',
          subject:pick(r,['CentralOR Print Co — Invoice #CP-'+(500+Math.floor(r()*4000)),'High Desert Charters — Invoice #HD-'+(100+Math.floor(r()*900)),'Riverbend PA & Staging — Invoice #RB-'+(200+Math.floor(r()*700)),'Juniper Signworks — Invoice #JS-'+(300+Math.floor(r()*900))]),
          from:'', to:'', cc:'',
          body:'INVOICE\n\nBill to: Cascade Headwaters Alliance\nServices: '+pick(r,['flyer and yard-sign printing','charter bus service, rally day','PA system and stage rental','banner fabrication'])+'\nAmount due: '+money(r,300,6000)+' net 30.\n\nRemit to accounts receivable.',
          issues:[],
          answer:{ responsive:'responsive', privilege:'not-privileged', action:'produce', conf:'confidential', issues:[] },
          explanation:'Routine vendor invoice for event services — responsive background material, shared with an outside commercial vendor, so neither privileged nor confidential associational content. Produce as Confidential with no substantive issue tags.' };
      }},
    // Junk / personal noise — not responsive (w:5)
    { w:5, cust:['cust-ed','cust-org','cust-dev','cust-vol','cust-ops'], make:function(r,cust){
        return { type:'email',
          subject:pick(r,['Nonprofit Quarterly — this week’s stories','Your conference registration is confirmed','Office coffee order','Trail run Saturday?','Dentist appointment reminder']),
          from:pick(r,['NPQ <news@npquarterly.org>','Events <events@nonprofitwest.org>','Bend Roasters <orders@bendroasters.com>','Trail Club <runs@bendtrailclub.org>','Smile Dental <appointments@smiledental.com>']),
          to:person(cust), cc:'',
          body:pick(r,[
            'This week in the nonprofit sector: fundraising trends, board governance tips, and upcoming webinars. Unsubscribe below.',
            'Your registration for the Nonprofit West conference is confirmed. See you in Portland in October.',
            'Your monthly coffee order has shipped: two cases of medium roast, one decaf.',
            'Group trail run Saturday 8 AM, Shevlin Park upper lot. Reply to RSVP.',
            'Reminder: your dental cleaning is scheduled for next Tuesday at 2:30 PM.']),
          issues:[],
          answer:{ responsive:'non-responsive', privilege:'not-privileged', action:'withhold', conf:'confidential', issues:[] },
          explanation:'Bulk newsletter or personal noise with no connection to the pipeline dispute or any discovery request. Not responsive; withhold. Teaches quick disposal of obvious junk without over-coding.' };
      }},
    // Corrupted / failed processing — technical (w:3)
    { w:3, cust:['cust-ops'], make:function(r,cust){
        return { type:'file',
          subject:pick(r,['gis_layers_backup_0'+(1+Math.floor(r()*9))+'.zip (no text extracted)','rally_video_raw.mov (no text extracted)','old_laptop_image.dd (unreadable)','donor_db_export.bak (corrupted)']),
          from:'', to:'', cc:'',
          body:'[This file could not be rendered for review. No text could be extracted from the container. Flag to the technical/processing team for re-collection.]',
          issues:[],
          answer:{ responsive:'technical', privilege:'not-privileged', action:'withhold', conf:'confidential', issues:[] },
          explanation:'The file failed processing and cannot be reviewed. Code Responsiveness as Technical Issue and route for re-collection — never guess substantive coding for an unreadable file.' };
      }}
  ];

  var POOL=[];
  A.forEach(function(a,i){ for(var k=0;k<a.w;k++) POOL.push(i); });

  for (var n=16; n<=500; n++){
    var r = rngFor(n*2654435761 + 17);
    var arch = A[POOL[Math.floor(r()*POOL.length)]];
    var cust = pick(r, arch.cust);
    var d = arch.make(r, cust);
    var id = 'FA-' + ('000'+n).slice(-4);
    FA_DOCS.push({
      id:id, type:d.type, custodian:cust, tags:d.issues.slice(),
      from:d.from, to:d.to, cc:d.cc,
      date:(d.type==='file' ? fileDate(r) : dateStr(r)),
      subject:d.subject, body:d.body,
      answer:d.answer, explanation:d.explanation
    });
  }
})();
```

- [ ] **Step 4: Run the verification — verify it passes**

Run the Step 1 command. Expected output: `PASS: 500 FA docs, unique deterministic ids, valid coding, mix ok`

If the mix thresholds fail (weights are probabilistic per-seed), adjust archetype weights slightly (e.g., bump the member-communications weight) and re-run — do not lower the thresholds.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(firstam): procedural generator for FA docs 16-500"
```

---

### Task 3: `CP_CASES.firstam` case object

**Files:**
- Modify: `index.html` — insert after the `// FA-DATA-END` marker, before `var CP_ACTIVE = 'antitrust';`

**Interfaces:**
- Consumes: `FA_DOCS` (Tasks 1–2); the `CP_CASES` object declared earlier in the file (~line 5347).
- Produces: `CP_CASES.firstam` with keys `{id, crumb, panelTitle, docs, hotBand, fields, issues, labels}` — the exact schema the Casepoint engine reads (`cpCase()`, `cpRenderPanel`, `cpRenderDoc`, `cpUpdateLanding`). Task 4's card calls `openCasepointCase('firstam')`.

- [ ] **Step 1: Write the failing verification check**

```bash
node -e '
const fs = require("fs");
const html = fs.readFileSync("index.html","utf8");
const m = html.match(/\/\/ FA-DATA-START([\s\S]*?)\/\/ FA-CASE-END/);
if (!m) { console.error("FAIL: FA case section not found (missing FA-CASE-END marker?)"); process.exit(1); }
var CP_CASES = {};
eval(m[1]);
const c = CP_CASES.firstam;
if (!c) { console.error("FAIL: CP_CASES.firstam not defined"); process.exit(1); }
if (c.id !== "firstam" || c.docs !== FA_DOCS) { console.error("FAIL: id/docs wiring wrong"); process.exit(1); }
for (const k of ["crumb","panelTitle","hotBand","fields","issues","labels"]) {
  if (!c[k]) { console.error("FAIL: missing case key " + k); process.exit(1); }
}
const privField = c.fields.find(f => f.key === "privilege");
const privVals = privField.options.map(o => o.v).sort().join(",");
if (privVals !== "fa-flag,not-privileged,privileged") { console.error("FAIL: privilege options are " + privVals); process.exit(1); }
if (c.fields.map(f => f.key).join(",") !== "responsive,privilege,action,conf") { console.error("FAIL: field keys wrong"); process.exit(1); }
const issueVals = c.issues.options.map(o => o.v).sort().join(",");
if (issueVals !== "issue1,issue2,issue3,issue4") { console.error("FAIL: issue options wrong"); process.exit(1); }
// Every answer value used by any doc must have a label (cpLabel falls back, but grading feedback should read cleanly).
for (const d of FA_DOCS) {
  const a = d.answer;
  for (const v of [a.responsive, a.privilege, a.action, a.conf, ...a.issues]) {
    if (!c.labels[v]) { console.error("FAIL: no label for value " + v + " (doc " + d.id + ")"); process.exit(1); }
  }
}
console.log("PASS: CP_CASES.firstam valid, all answer values labeled");
'
```

- [ ] **Step 2: Run it — verify it fails**

Expected output: `FAIL: FA case section not found (missing FA-CASE-END marker?)` with exit code 1.

- [ ] **Step 3: Insert the case object**

Immediately after the `// FA-DATA-END` line and before `var CP_ACTIVE = 'antitrust';`, insert:

```javascript
CP_CASES.firstam = {
  id: 'firstam',
  crumb: '<b>TransRidge Pipeline v. Cascade Headwaters</b> &nbsp;›&nbsp; First Level Review &nbsp;›&nbsp; First Amendment Privilege',
  panelTitle: 'First Amendment Review Coding',
  docs: FA_DOCS,
  hotBand: '🔥 <strong>Hot Document:</strong> This document may contain smoking-gun content about the alleged trespass or property damage — code carefully. The First Amendment does not shield evidence of unlawful conduct.',
  fields: [
    { key:'responsive', label:'RESPONSIVENESS', options:[
      {v:'responsive',l:'Responsive'},{v:'non-responsive',l:'Not Responsive'},{v:'technical',l:'Technical Issue'}]},
    { key:'privilege', label:'PRIVILEGE', options:[
      {v:'not-privileged',l:'Not Privileged'},{v:'privileged',l:'Privileged (A-C)'},{v:'fa-flag',l:'First Am. — Flag & Escalate'}]},
    { key:'action', label:'PRODUCTION', options:[
      {v:'produce',l:'Produce'},{v:'withhold',l:'Withhold'},{v:'redact',l:'Redact'}]},
    { key:'conf', label:'CONFIDENTIALITY', options:[
      {v:'confidential',l:'Confidential'},{v:'hc-aeo',l:'Highly Conf. – AEO'}]}
  ],
  issues: { label:'ISSUE TAGS', options:[
    {v:'issue1',l:'Membership & Donors',color:'#2e9e5b'},
    {v:'issue2',l:'Protest Strategy',color:'#b8860b'},
    {v:'issue3',l:'Trespass / Property Damage',color:'#c62828'},
    {v:'issue4',l:'Hot Doc',color:'#d6453a'}]},
  labels: {
    'responsive':'Responsive','non-responsive':'Not Responsive','technical':'Technical Issue',
    'not-privileged':'Not Privileged','privileged':'Privileged (Attorney-Client)','fa-flag':'First Amendment — Flag & Escalate',
    'produce':'Produce','withhold':'Withhold','redact':'Redact',
    'confidential':'Confidential','hc-aeo':'Highly Confidential – AEO',
    'issue1':'Membership & Donors','issue2':'Protest Strategy','issue3':'Trespass / Property Damage','issue4':'Hot Doc'
  }
};
// FA-CASE-END (marker used by data checks — do not remove)
```

- [ ] **Step 4: Run the verification — verify it passes**

Run the Step 1 command. Expected output: `PASS: CP_CASES.firstam valid, all answer values labeled`

- [ ] **Step 5: Re-run the Task 2 check (regression)**

Run the Task 2 Step 1 command. Expected: `PASS: 500 FA docs, unique deterministic ids, valid coding, mix ok`

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat(firstam): CP_CASES.firstam case object with Flag & Escalate privilege option"
```

---

### Task 4: Other Projects page card

**Files:**
- Modify: `index.html` — inside `<div id="page-other-projects">`, insert after the St. Aurelius breach card's closing `</div>` (the card ends right before the `<!-- PROJECT 4: AI -->` comment)

**Interfaces:**
- Consumes: `openCasepointCase('firstam')` (engine, existing) and `CP_CASES.firstam` (Task 3).
- Produces: card with counter elements `id="cp-proj-coded-firstam"` and `id="cp-proj-acc-firstam"` — `cpUpdateLanding()` fills these automatically because it iterates `Object.keys(CP_CASES)`.

- [ ] **Step 1: Write the failing verification check**

```bash
node -e '
const html = require("fs").readFileSync("index.html","utf8");
const checks = [
  ["openCasepointCase(&apos;firstam&apos;) card onclick", /openCasepointCase\('"'"'firstam'"'"'\)/],
  ["coded counter id", /id="cp-proj-coded-firstam"/],
  ["accuracy counter id", /id="cp-proj-acc-firstam"/],
  ["card title", /Cascade Headwaters — Pipeline Protest Discovery/]
];
let fail = false;
for (const [name, re] of checks) {
  if (!re.test(html)) { console.error("FAIL: missing " + name); fail = true; }
}
const page = html.match(/<div id="page-other-projects"[\s\S]*?<div id="page-/);
if (!page || !/cp-proj-coded-firstam/.test(page[0])) { console.error("FAIL: card not inside page-other-projects"); fail = true; }
if (fail) process.exit(1);
console.log("PASS: firstam card present on Other Projects page");
'
```

- [ ] **Step 2: Run it — verify it fails**

Expected: `FAIL: missing …` lines, exit code 1.

- [ ] **Step 3: Insert the card**

Find the St. Aurelius breach card (starts `<div class="card proj-case-card" onclick="openCasepointCase('breach')"`) and its closing `</div>` — which sits immediately before the `<!-- PROJECT 4: AI -->` comment. Insert between them:

```html
  <!-- FIRST AMENDMENT PROJECT -->
  <div class="card proj-case-card" onclick="openCasepointCase('firstam')" style="border-color:#2e7d32;margin-bottom:14px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
      <div>
        <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border-radius:14px;font-size:.71rem;font-weight:700;margin-bottom:8px;background:rgba(46,125,50,.14);color:#66bb6a;border:1px solid #2e7d32;">⚖️ First Amendment · Associational Privilege · Casepoint Platform</div>
        <div class="proj-case-title" style="color:#66bb6a">🌲 Cascade Headwaters — Pipeline Protest Discovery</div>
        <div class="proj-case-sub">TransRidge Pipeline LLC v. Cascade Headwaters Alliance · Membership &amp; Donor Discovery · Qualified Privilege Balancing · Flag &amp; Escalate Protocol</div>
        <div class="proj-issues-bar" style="margin-top:8px;">
          <span class="proj-issue-tag" style="background:rgba(46,158,91,.15);color:#4caf50;border:1px solid #2e9e5b;">Issue 1: Membership &amp; Donors</span>
          <span class="proj-issue-tag" style="background:rgba(184,134,11,.15);color:#f9a825;border:1px solid #b8860b;">Issue 2: Protest Strategy</span>
          <span class="proj-issue-tag" style="background:rgba(198,40,40,.15);color:#ff6659;border:1px solid #c62828;">Issue 3: Trespass / Property Damage</span>
          <span class="proj-issue-tag" style="background:rgba(214,69,58,.15);color:#ff5252;border:1px solid #d6453a;">Issue 4: Hot Doc</span>
        </div>
        <div style="margin-top:10px;font-size:.78rem;color:var(--muted);">🖥️ Runs on <strong style="color:#66bb6a">Casepoint</strong> · 500 documents · Qualified privilege — flag, don&#39;t assume</div>
      </div>
      <div style="text-align:center;flex-shrink:0;">
        <div style="font-size:1.5rem;font-weight:800;color:#66bb6a" id="cp-proj-coded-firstam">0</div>
        <div style="font-size:.7rem;color:var(--muted)">coded</div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:4px" id="cp-proj-acc-firstam">— accuracy</div>
      </div>
    </div>
    <div style="margin-top:12px;background:#2e7d32;color:#fff;border:none;border-radius:7px;padding:10px;font-weight:700;font-size:.84rem;text-align:center;">Open in Casepoint →</div>
  </div>

```

- [ ] **Step 4: Run the verification — verify it passes**

Run the Step 1 command. Expected: `PASS: firstam card present on Other Projects page`

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(firstam): Cascade Headwaters project card on Other Projects page"
```

---

### Task 5: End-to-end browser verification

**Files:**
- No file changes expected (fix-forward if a defect is found, then re-run).

**Interfaces:**
- Consumes: everything from Tasks 1–4 running in a real browser.

- [ ] **Step 1: Serve the app**

```bash
python3 -m http.server 8000 &
```

- [ ] **Step 2: Open in browser and check for console errors**

Using Playwright MCP tools: `browser_navigate` to `http://localhost:8000`, then `browser_console_messages`.
Expected: no JavaScript errors (warnings from Supabase auth calls without a session are acceptable — they exist today).

- [ ] **Step 3: Open the case directly and verify the doc set**

Use `browser_evaluate` (bypasses the login wall, which gates nav but not these functions):

```javascript
() => { openCasepointCase('firstam'); return { count: cpDocs().length, first: cpDocs()[0].id, last: cpDocs()[499].id, crumb: document.getElementById('cp-crumb').textContent }; }
```

Expected: `{ count: 500, first: "FA-0001", last: "FA-0500", crumb: "TransRidge Pipeline v. Cascade Headwaters › First Level Review › First Amendment Privilege" }` (crumb whitespace may vary).

- [ ] **Step 4: Verify the coding panel shows the Flag & Escalate option**

`browser_evaluate`:

```javascript
() => Array.from(document.querySelectorAll('#cp-coding-panel .cp-option')).map(o => o.textContent.trim()).filter(t => t.includes('First Am'))
```

Expected: an array containing `"First Am. — Flag & Escalate"`.

- [ ] **Step 5: Code a document end-to-end**

Take a `browser_snapshot`, click doc `FA-0002` in the list, select Responsive / First Am. — Flag & Escalate / Withhold / Highly Conf. – AEO / Issue 1, submit, and confirm the grading feedback marks it correct and shows the explanation text beginning "The complete membership roster is the classic associational-privilege document".

- [ ] **Step 6: Verify redaction spans render on FA-0010**

Click doc `FA-0010`; confirm the body shows clickable redaction targets for the phone numbers and addresses (the `⟦PII|…⟧` spans render as the same click-to-redact elements used in the St. Aurelius case).

- [ ] **Step 7: Verify persistence across reload**

`browser_navigate` to `http://localhost:8000` again (full reload), then `browser_evaluate`:

```javascript
() => { openCasepointCase('firstam'); return { savedCodings: Object.keys(cpCodingFor()).length, hasFA0002: !!cpCodingFor()['FA-0002'] }; }
```

Expected: `{ savedCodings: 1, hasFA0002: true }` — the FA-0002 coding from Step 5 must survive the reload via localStorage.

- [ ] **Step 8: Verify the landing card counter**

`browser_evaluate`:

```javascript
() => { closeCasepoint(); cpUpdateLanding(); return document.getElementById('cp-proj-coded-firstam').textContent; }
```

Expected: `"1"` (the one doc coded in Step 5).

- [ ] **Step 9: Stop the server**

```bash
kill %1
```

- [ ] **Step 10: Commit (only if fixes were needed)**

```bash
git add index.html
git commit -m "fix(firstam): browser verification fixes"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing. Documentation only.

- [ ] **Step 1: Update the stale quirk note and document the new case**

In `CLAUDE.md`:

1. Delete the entire **Known quirk** paragraph (the file no longer has a duplicate `<!DOCTYPE html>` fragment — it is now ~7,900 lines with a single DOCTYPE).

2. In the **Simulator cases** section, after the Case 4 line, add:

```markdown
- Casepoint cases (`CP_CASES`, launched from `other-projects` via `openCasepointCase(id)`): `antitrust` (NorthStar/Meridian, `CP_DOCS`), `breach` (St. Aurelius, `SAH_DOCS`), `firstam` (TransRidge v. Cascade Headwaters — First Amendment privilege, `FA_DOCS`, 500 docs: 15 hand-authored + seeded generator)
```

3. In the **Key module boundaries** list, add a line:

```markdown
- `// CASEPOINT — TRANSRIDGE PIPELINE v. CASCADE HEADWATERS ALLIANCE` — `FA_DOCS` + `CP_CASES.firstam`; First Amendment qualified-privilege case with `fa-flag` (Flag & Escalate) coding option; `FA-DATA-START`/`FA-DATA-END`/`FA-CASE-END` markers are used by data-integrity check scripts — keep them
```

- [ ] **Step 2: Verify**

```bash
grep -c "duplicate" CLAUDE.md; grep -c "firstam" CLAUDE.md
```

Expected: `0` for duplicate (quirk note gone), `>= 1` for firstam.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document firstam Casepoint case, drop stale duplicate-DOCTYPE quirk note"
```
