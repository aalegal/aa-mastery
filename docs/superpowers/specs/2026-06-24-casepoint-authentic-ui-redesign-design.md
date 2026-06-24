# Casepoint Shell — Authentic Platform UI Redesign

**Date:** 2026-06-24
**Status:** Approved design, ready for implementation planning

## Summary

Restyle the existing Casepoint review shell so it visually resembles the **real
Casepoint eDiscovery platform** used by government agencies — instead of the current
dark theme, which is a re-skin of the Everlaw/Relativity shells and reads as "the
same platform in a different color." The redesign is **presentation-only**: the
`cp-*` CSS and the shell markup / `cpRenderList` / `cpRenderDoc` HTML change; coding
logic, the `CP_DOCS` dataset, scoring, feedback, live stats, and persistence are
untouched.

## Context

The Casepoint project (NorthStar / Meridian DOJ Second Request) was implemented as a
fixed-overlay shell `#casepoint-shell` with `cp-*` functions mirroring the Everlaw
shell. It currently uses a **dark** theme (teal accent on near-black panels), making
it look like the other two dark mock platforms.

Public research into the real Casepoint platform establishes:

- **Light theme** — white backgrounds, generous whitespace, dark-navy text, a single
  blue accent; a professional/corporate look aimed at government and enterprise.
- **Left-side tiered navigation rail** is the signature chrome (Home, Data
  Management, Batches, Actions, Reports/dashboards).
- **Coding pane** with Tags, Issues, custom fields, and Notes; supports conditional
  coding, mutually-exclusive coding warnings, Apply Previous, and family propagation.

Sources: casepoint.com homepage and about page (theme/branding); "Six Ways We Made
Casepoint Easier to Use" (left navigation, Batches/Actions menus); "eDiscovery
Coding Features" and the Document Review resource (coding pane).

This is an approximation grounded in public material (the live review module is
behind authentication), accepted by the user as the sourcing approach.

## Goals

- The Casepoint shell reads as a distinct, authentic Casepoint-style platform — light
  theme, left navigation rail, grid-style document list, white document viewer, and a
  Casepoint-styled coding pane.
- No regression to coding behavior, scoring, feedback, stats, or persistence.
- No impact on the Relativity or Everlaw shells.

## Non-Goals (YAGNI)

- No pixel-exact clone (impossible without the authenticated app); a faithful
  approximation of layout, theme, and chrome.
- No new coding behaviors (conditional/mutually-exclusive/propagation are real
  Casepoint features but out of scope; the existing 5-field model stays).
- No changes to `CP_DOCS`, scoring, persistence, or the project card's behavior.
- No new navigation page or Supabase changes.

## Design

### 1. Theme flip — dark → light

Recolor the `cp-*` CSS to a light palette:

- Surfaces: app background `#eef1f6`; panels/cards `#ffffff`; subtle section fills
  `#f7f9fc`.
- Text: primary `#1a2b4a` (dark navy), secondary `#5b6b85`, muted `#8a97ab`.
- Accent: Casepoint blue `#1f6fc4` (hover `#175aa3`), used for the active nav item,
  selected doc row, links, and the primary coding button.
- Borders: `#dfe5ee` (1px), with soft shadows (`0 1px 3px rgba(20,40,80,.08)`) on
  cards instead of dark borders.
- Status dots / chips keep semantic colors (green/amber/red) but tuned for a light
  background.

Because the shell is a fixed full-screen overlay, the app's global dark `:root`
tokens do not need to change — the `cp-*` rules set their own colors explicitly.

### 2. Casepoint chrome

- **Left navigation rail** (`#cp-railnav`, ~64px, navy `#13294b` background): a
  vertical stack of icon buttons with tiny labels — Home, Batches, Review (active),
  Search, Actions, Reports. Decorative (the active "Review" item is highlighted);
  only the existing close action is wired. The rail is what most signals "Casepoint."
- **Top bar** (`#cp-topbar`, white, ~48px): navy **"Casepoint"** wordmark at left, a
  breadcrumb / matter label ("NorthStar v. Meridian › First Level Review"), and the
  coded%/accuracy readout + "Exit" button at right.
- The review workspace (progress bar + three panels) sits to the right of the rail,
  below the top bar.

### 3. Three review panels, Casepoint-styled

- **Doc list** (`#cp-left`, white): **grid-style rows** with a checkbox, a status
  dot, the doc id (monospace), a one-line subject, and a small metadata line
  (custodian · date · type). Selected row gets a light-blue fill (`#e8f1fb`) and a
  blue left edge. A thin header row labels the list ("Documents").
- **Viewer** (`#cp-viewer`): a light gray gutter (`#eef1f6`) wrapping a centered
  white "document page" (`#cp-doc-body`, max-width ~820px, white card with a soft
  shadow). The header band stays white with navy subject text and the nav arrows.
  The hot-doc band and tag chips restyle for the light background.
- **Coding pane** (`#cp-coding-panel`, white card, right): a titled "Coding" header,
  then labeled sections — RESPONSIVENESS · PRIVILEGE · ISSUE TAGS · PRODUCTION ·
  CONFIDENTIALITY — rendered as Casepoint-style option lists (light pills/rows with
  blue selected state), plus the existing Save/Skip buttons restyled in Casepoint
  blue.

### 4. Markup / render changes

- `#casepoint-shell` markup: wrap existing content in a new flex layout — left rail +
  (top bar over the existing main). Add the rail and top-bar markup; move the
  progress bar and `#cp-main` under the top bar.
- `cpRenderList`: emit grid-style rows (checkbox + dot + id + subject + meta) with the
  new classes.
- `cpRenderDoc`: wrap the body in the white "document page" container; restyle the
  hot-doc band and tag chips for light theme. Header/field markup unchanged in
  structure (only classes/styles).
- All IDs consumed by JS (`cp-doc-list`, `cp-doc-body`, `cp-field-*`, `cp-submit-btn`,
  `cp-prog-pct`, `cp-accuracy-disp`, `cp-progress-fill`, `cp-doc-subject-bar`,
  `cp-doc-counter`, `cp-prev-btn`, `cp-next-btn`, `cp-panel-doc-id`) are **preserved**
  so no JS changes are required. The close handler `closeCasepoint()` and option
  `onclick`s are unchanged.

### 5. Project card

The Other Projects card keeps its content but its accent shifts from teal to
Casepoint blue (`#1f6fc4`) so the entry matches the platform it opens. Wording and
stats IDs (`cp-proj-coded`, `cp-proj-acc`) unchanged.

## Testing

- Manual browser walkthrough (`python3 -m http.server 8000`): open the card → light
  Casepoint shell with left rail + top bar renders; doc list is grid-style; selecting
  a row shows the white document page; coding a doc still scores/gives feedback;
  progress + accuracy + landing stats still update; reload still restores coding.
- Confirm all JS-consumed IDs still resolve (no console errors; `cpOpenDoc`,
  `cpSubmitCoding`, filters, nav all work).
- Visual screenshot to confirm the light theme + rail read as Casepoint.
- Regression: Everlaw and Relativity shells unaffected; persistence keys coexist.
- XSS: any new dynamic insertions still go through `esc`/`escAttr`.

## Open Questions

None.
