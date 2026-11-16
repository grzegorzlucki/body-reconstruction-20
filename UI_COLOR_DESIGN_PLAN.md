# UI and Color Design Plan

## Goal

Make Body Reconstruction easier to use during short daily check-ins and hands-on workouts, especially on phones, while retaining its calm dark-green identity. Favor clear hierarchy, readable controls, predictable navigation, and visible feedback over decorative density.

This is a design plan. It does not describe work that has already been implemented. The existing interface and styles were reviewed in `src/views/`, `src/app/`, and `src/styles/`.

## Implementation progress

- **Batch 1 — Foundation and token migration:** implemented semantic tokens, migrated component colors, added shared interaction/focus behavior, and moved shared mobile overrides into `responsive.css`. The existing color values are retained for now; a deliberate palette adjustment follows a contrast review in a later batch.
- The production build could not be run in the current environment because neither `node` nor `npm` is available on `PATH`.

## Design principles

1. **Put the next useful action first.** On Today, prioritize resume workout or start workout, then today's pain check-in. On an active workout, prioritize the current exercise and set controls.
2. **Keep the interface calm and legible.** Use dark pine surfaces as the brand foundation, with mint reserved for primary actions and selected states. Use text and labels as well as color to communicate status.
3. **Design for a hand-held phone.** Avoid dense multi-column controls, tiny helper text, fixed bars that cover content, and long setup forms before the user can act.
4. **Make state obvious.** Distinguish loading, saved, offline/local, cloud-connected, empty, and error states with concise messages and a next action.
5. **Keep components and styles reusable.** Add semantic tokens and explicit component variants; avoid scattering literal colors or building a second styling system.

## Current interface findings

- `src/styles/tokens.css` has only six global color values; many components still repeat literal colors in `base.css`, `shell.css`, `forms.css`, `views.css`, and `timer.css`.
- The same raised green is used for the sidebar, cards, secondary buttons, and profile actions, so different interaction levels are not consistently distinguishable.
- Some information is visually too quiet for frequent use: compact labels and text in the dashboard, workout rows, navigation, and timer settings. Phone overrides improve some text sizes, but the desktop styles still start with small helper labels.
- `src/styles/responsive.css` contains overlapping mobile rules, while `src/style.css` appends further overrides. The final appearance depends on cascade order, making later UI refinements harder to reason about.
- On mobile, the five-item bottom bar is useful but consumes vertical space and must remain clear of the last action, focused inputs, and the software keyboard.
- The workout and plan flows contain many controls. Their phone layout needs explicit priority: active set entry first, optional detail second, finish/pause actions always easy to reach.
- The existing timer already uses phase colors, but rest and preparation currently share a color family. Their labels and visual states should be clearly distinguishable, without relying on color alone.

## Proposed color system

Keep the pine-and-mint identity. First centralize colors in `src/styles/tokens.css`; migrate component styles to semantic variables before changing individual shades. Values below are a starting palette to validate with contrast checks against every actual text/background pairing before implementation.

| Token | Starting value | Use |
|---|---:|---|
| `--color-page` | `#0D1714` | Main page background; slightly deeper than cards |
| `--color-surface` | `#14211C` | Sidebar, navigation, and broad secondary regions |
| `--color-panel` | `#1B2B24` | Cards, dialogs, and grouped content |
| `--color-panel-hover` | `#24382E` | Hover/pressed surface and subtle selected state |
| `--color-border` | `#3A5145` | Card/input boundaries and separators |
| `--color-text` | `#E7F0EA` | Main copy, headings, input values |
| `--color-text-secondary` | `#C0CEC5` | Body copy and supporting labels |
| `--color-text-muted` | `#AABBB0` | Metadata only; not essential instructions or field labels |
| `--color-accent` | `#A6E2BD` | Primary action, current navigation item, progress |
| `--color-accent-pressed` | `#8FD3AA` | Pressed primary action |
| `--color-accent-ink` | `#10251B` | Text/icons on mint buttons |
| `--color-focus` | `#F2C36B` | Keyboard focus ring, with sufficient contrast on dark surfaces |
| `--color-success` | `#8DDBA6` | Successful save/synced indicator plus text/icon |
| `--color-warning` | `#F2C36B` | Pending/offline/attention state plus explicit label |
| `--color-danger` | `#FFAAA0` | Destructive/error state plus explicit message |

Semantic background tokens should accompany status foreground tokens (for example, success/warning/danger panel backgrounds). Status must never be expressed by color alone. Validate text contrast to WCAG 2.2 AA for normal and large text and focus/control contrast for interactive states. Keep text muted only when it is genuinely secondary.

### Color usage rules

- One solid mint style for the primary action on each screen; secondary actions use a quiet outlined or raised style, and destructive actions use a clearly labeled danger style.
- A selected navigation item uses a restrained panel tint and a clear text/icon indicator. Do not paint every navigation item mint.
- Reserve warm amber for focus and warnings, not general decoration. Use a separate, labeled phase indicator for timer preparation versus rest.
- Keep borders visible on form controls and cards; do not use low-contrast hairlines to carry important grouping.
- Include hover, active, disabled, focus-visible, loading, and error/success states for every button and input family.

## Screen and interaction plan

### 1. App shell and navigation

Files: `src/app/AppShell.tsx`, `src/app/AppNavigation.tsx`, `src/styles/shell.css`, `src/styles/responsive.css`, `src/style.css`.

- Desktop: keep the left navigation stable, but separate its surface from page content. Make the active destination unmistakable and ensure storage/account status is readable without competing with navigation.
- Mobile: keep four high-frequency destinations plus “More”; increase the tap target to at least 44×44 CSS px, preserve safe-area padding, and show a text label for every icon.
- Consolidate breakpoint rules into one responsive source of truth. Remove obsolete/duplicate mobile rules after verifying each selector; avoid changing the established order by adding another override layer.
- Ensure bottom navigation does not obscure the final form action, active input, confirmation sheet, or focused element when the on-screen keyboard opens. Test scroll padding and safe-area behavior on real iOS Safari and Android Chrome.
- Provide visible `:focus-visible` states for navigation, profile controls, dialogs, and links; maintain keyboard access and meaningful current-page semantics.

### 2. Today dashboard

File: `src/views/TodayView.tsx` plus `src/styles/views.css`.

- Keep the page title compact enough that the primary action appears early on a phone.
- If a workout is in progress, show a prominent “Resume workout” action with its plan name and a concise progress summary. If none is active, show “Start workout” and the selected/recent plan.
- Present today's pain check-in as the next clear task, including its saved/not-yet-recorded state and one direct link to add or edit it.
- Keep weekly activity and recovery metrics secondary. On narrow screens show compact summary cards; do not make three equally prominent panels compete with the main action.
- Show connection/storage mode in a consistent status component with human-readable state and recovery guidance if data could not be loaded.

### 3. Workout setup, active workout, and plans

Files: `src/views/WorkoutView.tsx`, `src/Plans.tsx`, `src/SessionFields.tsx`, `src/SetNumberInput.tsx`, `src/ExerciseTimer.tsx`, `src/styles/forms.css`, `src/styles/views.css`, `src/styles/timer.css`.

- Split the setup hierarchy visually into “Choose a saved plan”, “Adjust today’s workout”, and “Start”; prevent the saved-plan chooser, pain monitor, editor, and composer from reading like one continuous form.
- In a saved-plan card show exercise count, set count, timer badge, and explicit actions. Keep “Start plan” primary; “Edit” and “Customize” secondary.
- On a phone, make each set row easy to scan: set number/status, weight, reps, and completion state. Stack numeric fields when a three-column layout becomes cramped; keep labels visible and use numeric input modes.
- Reduce repeated exercise description in the active workout. Keep details/notes available in a disclosure when not needed for the current set.
- Keep pause/resume, finish-early, and stop actions distinct from destructive discard. Confirm only actions that lose saved progress; show the next step after the action.
- Add a clear current-exercise progress marker and make set completion feedback immediate. Avoid forcing users to scroll past unrelated content to reach the active exercise controls.

### 4. HSR timer and per-exercise timer

Files: `src/HsrTimer.tsx`, `src/ExerciseTimer.tsx`, `src/intervalTimer.ts`, `src/styles/timer.css`.

- Make the timer phase the primary label and number the strongest visual element. Use tabular numerals and keep the timer stable in width to prevent layout shifts.
- Distinguish “Przerwa” and the final preparation countdown using both a phase label and a separate icon/color treatment. Preparation should replace the phase label during the final configured seconds; it is a phase of the same rest interval, not extra time.
- Keep pause/resume and stop/finish controls large and separated. Avoid placing destructive stop beside the primary pause control without clear distinction.
- At narrow widths keep settings in a readable single-column layout. During a running timer, collapse or move nonessential settings below the timer controls.
- Respect reduced motion and provide sound enablement/status with text feedback.

### 5. Diary, history, calendar, and data

Files: `src/views/DiaryView.tsx`, `src/views/HistoryView.tsx`, `src/views/DataView.tsx`, `src/Calendar.tsx`, `src/PainCharts.tsx`.

- Use the same page-title, section-heading, panel, form, and empty-state patterns on every screen.
- In diary entry, group pain ratings by site, use a visible 0–10 scale label, and give each control a comfortably large touch target. Make save state and validation visible next to the relevant input.
- In history and calendar, distinguish workout and pain-log markers with both symbols/labels and color. Provide a compact legend and readable selected-day details on mobile.
- Charts need a textual summary for important values and keyboard/touch access to readings; avoid tiny chart labels and color-only series differentiation.
- In Data, clearly separate local data, cloud account, import/export, and troubleshooting. Explain the currently active storage location before offering transfer/destructive operations.

## Typography, spacing, and control standards

- Keep the existing DM Sans/Manrope identity initially; do not add more font families. Audit font loading and fallbacks because the app must remain legible offline.
- Use 16px minimum for regular mobile body text and field values; aim for at least 14px for labels, metadata, and controls when they convey instructions. Avoid 9–11px text for any actionable or essential information.
- Establish a small type scale for page title, section title, card title, body, label, and metadata. Use `text-wrap: balance` for headings and tabular numerals for timer/count columns.
- Establish a spacing scale (4, 8, 12, 16, 24, 32px) and a radius scale (8, 12, 16px); use them consistently for forms, cards, dialogs, and buttons.
- All primary inputs and actions should be at least 44px tall; give checkboxes and their labels a shared large hit area. Keep visible labels; placeholders are examples, never the only label.
- Use one card treatment and a shallow visual hierarchy (page background → panel → control). Avoid nesting cards inside cards unless the inner group is a distinct workflow step.

## Responsive targets and acceptance criteria

| Viewport | Expected layout |
|---|---|
| 320–359px | One column; no horizontal scrolling; fields stack; bottom navigation remains legible and never covers a focused control |
| 360–699px | Phone-first hierarchy; primary action appears near the top; set inputs remain touch-friendly; bottom bar respects safe areas |
| 700–1023px | Compact navigation/layout without squeezed three-column forms; cards use two columns only when their content remains readable |
| 1024px+ | Desktop sidebar and comfortable reading width; dashboard cards can use three columns; line length remains controlled |

Acceptance criteria for the redesign:

1. A first-time user can identify where to start/resume a workout and where to record today's pain without interpreting decorative copy.
2. A returning user can launch a saved plan from the workout area without first scrolling through unrelated metrics or monitoring details.
3. During a workout, every set input and its completion state can be operated at 320–390px without horizontal scrolling or accidental adjacent taps.
4. All important text/control combinations meet WCAG 2.2 AA contrast; focus, status, and error are identifiable without color alone.
5. The bottom navigation, keyboard, dialogs, and safe areas never hide the currently focused control or the final action.
6. The timer clearly announces rest versus preparation and keeps the configured total rest duration unchanged.
7. Data loading/saving/offline failures say what happened and offer the relevant next action; no raw infrastructure error is the only visible feedback.
8. The visual system uses semantic CSS variables; screen components do not introduce new arbitrary hex colors.

## Implementation batches

### Batch 1 — Foundation and token migration

- Define semantic color, status, typography, spacing, radius, and elevation tokens in `src/styles/tokens.css`.
- Replace repeated hex colors in the shared style modules with tokens; preserve current appearance closely until contrast values are verified.
- Normalize global focus, hover, active, disabled, form, link, and button states in `base.css` and `forms.css`.
- Consolidate duplicate responsive rules from `responsive.css` and `style.css` into one documented set of breakpoints.

**Done when:** there is one semantic token source; no critical text depends on `--color-text-muted`; all controls have visible focus and clear disabled/pressed states; no regression in existing navigation widths.

### Batch 2 — App shell and Today hierarchy

- Refine sidebar/mobile navigation distinction, storage status, account controls, safe-area spacing, and keyboard behavior.
- Reorder and simplify the Today content hierarchy as described above, preserving all current routes and actions.

**Done when:** the primary action and today's check-in are easy to find at 320, 390, 768, and desktop widths, with no overlay collision.

### Batch 3 — Workout and saved-plan use

- Separate saved-plan selection from plan composition and health context.
- Redesign set rows, exercise cards, timer badges, and active-workout controls for phone use.
- Keep existing plan persistence and workout behaviors; this batch changes presentation and interaction affordances only.

**Done when:** a saved plan launches in one clear action; starting, editing, finishing early, pausing, and discarding are visually distinct and understandable.

### Batch 4 — Timer, forms, and remaining views

- Clarify the timer phase display, preparation-vs-rest presentation, and mobile settings layout.
- Standardize diary, history, calendar, charts, and data page typography, empty states, status feedback, and touch targets.

**Done when:** repeated controls look and behave consistently across views and status meaning is not color-only.

### Batch 5 — Responsive and accessibility review

- Review the interface at 320, 360, 390, 768, 1024, and 1440px, with keyboard navigation, 200% zoom, reduced motion, long user-generated names, and form errors.
- Verify text and control contrast using the final token pairings; inspect on iOS Safari and Android Chrome for keyboard/safe-area collisions.
- Run existing unit/build/E2E checks when implementation is requested and relevant; add automated coverage only for newly introduced behavioral contracts.

**Done when:** the acceptance criteria above pass and the architecture map points to the final style and screen ownership.

## Guidance applied

- `skills/web-design-guidelines/SKILL.md`: semantic controls, accessible names, visible focus, field labels, inline errors, reduced motion, safe areas, touch sizing, long-content handling, and explicit interactive states. Latest upstream source reviewed: [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
- `skills/react-best-practices/SKILL.md`: keep UI work in focused components, avoid unnecessary component-wide state/render costs, and load genuinely heavy secondary views on demand where the existing app already does so.
- `skills/composition-patterns/SKILL.md`: represent distinct UI modes with clear component variants/composition rather than proliferating boolean props.
- `skills/taste-skill-main/skills/taste-skill/SKILL.md`: apply its restraint, coherent system, and consistent interaction feedback selectively. Its marketing-site hero, photography, and page-section rules do not fit this utility app and are not part of this plan.
