<h1 align="center">Smyrna Tools Design System</h1>

<p align="center">
  <b>The shared vocabulary for motion, elevation, focus, and interaction.</b>
</p>
<p align="center">
  One source of truth so every view — fleet, people, plants, admin —<br />
  feels like the same product in both themes.
</p>

<br />

## Why this file

Every visual change should read from this file and align with the patterns below, so the product feels coherent across views. The substrate is **Tailwind v3 + CSS custom properties** with two themes (light and dark). Tokens like `bg-bg-primary`, `text-text-primary`, `border-border-light`, and `bg-accent` are defined in `tailwind.config.js` and backed by CSS variables in [`src/app/index.css`](../index.css).

> **Never** hardcode hex colors. **Never** write raw CSS. Tailwind-only.

## Motion

Three speeds. Pick by the size of what moves.

| Token | Duration | Tailwind utility | Use for                                               |
| :---- | :------- | :--------------- | :---------------------------------------------------- |
| fast  | 150 ms   | `duration-150`   | Tiny state changes — hovers, focus rings, color flips |
| base  | 200 ms   | `duration-200`   | Small UI elements — buttons, badges, pills, dropdowns |
| slow  | 300 ms   | `duration-300`   | Panels, modals, page-level fades, list reveal         |

Easing — match the kind of motion, not the speed.

| Curve         | Tailwind      | Use for                                                  |
| :------------ | :------------ | :------------------------------------------------------- |
| `ease-out`    | `ease-out`    | Anything entering or leaving — the default for state     |
| `ease-in-out` | `ease-in-out` | Loops and reversible state (theme toggles, tab switches) |

Two curves, and no third. A control that overshoots its resting position reads
as a toy, and this is a console someone works a shift in front of.

The Tailwind config already exposes named animations: `animate-fade-in`, `animate-fade-in-fast`, `animate-fade-slide-in`, `animate-slide-up`, `animate-pop-in`, `animate-msg-in`. Prefer these named animations over ad-hoc `transition` declarations. Never write `@keyframes` in CSS files — they live in `tailwind.config.js`.

**Reduced motion:** never auto-animate decorative loops without a way to disable. If you add a continuous loop (`animate-pulse-slow`, `animate-fuse-shimmer`), pair it with `motion-reduce:animate-none`.

## Elevation

The product is flat. A surface separates from the one behind it by a hairline
border and a step in background, not by a shadow.

| Level    | Tailwind utility | Use for                                             |
| :------- | :--------------- | :-------------------------------------------------- |
| flat     | (no shadow)      | Section backgrounds, cards, table cards, rows       |
| resting  | `shadow-card`    | A card that sits on a busy surface and needs a lift |
| raised   | `shadow-raised`  | Sticky chrome that scrolls over content             |
| floating | `shadow-modal`   | Modals, popovers, dropdown menus, drawers, toasts   |

A live status dot carries `shadow-glow`, which is the halo and not a level.
Every one of these resolves to a `--shadow-*` custom property in `index.css`,
so a shadow is never written out at the point of use.

Cards don't lift on hover. A clickable card or row answers hover with
`hover:bg-bg-hover` or a darker border (`hover:border-border-medium`), and
nothing moves.

Use `border border-border-light` for a card's edge and `border-border-medium`
for controls (inputs, selects, secondary buttons).

## Radius

Square-ish. Corners are there to keep edges from looking sharp, not to make
things look soft.

| Token | Tailwind               | Use for                                            |
| :---- | :--------------------- | :------------------------------------------------- |
| pill  | `rounded-full`         | Avatars, status dots, count bubbles                |
| input | `rounded-[4px]`        | Inputs, selects, buttons, badges (`rounded-[3px]`) |
| card  | `rounded-card` (6 px)  | Cards, table cards, dropdown menus, popovers       |
| modal | `rounded-modal` (8 px) | Modals, dialogs, sheets                            |

Match radius across stacked elements (a button inside a card uses `rounded-[4px]`;
the card uses `rounded-card`). A table card's header row and body share one
`rounded-card` outline: the header takes `rounded-t-card`, the body has no top
border and square top corners.

## Focus, hover, active

Every interactive element must read in both themes. The pattern:

```jsx
className="
  transition-colors duration-150
  hover:bg-bg-hover

  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-accent
  focus-visible:ring-offset-2
  focus-visible:ring-offset-bg-primary
"
```

Rules:

- **Hover** flips background to `bg-bg-hover` (or shifts text to `text-text-primary` if the element is link-like). Never use raw colors like `hover:bg-gray-100`.
- **Active** darkens one more step (`active:bg-bg-tertiary`). Nothing scales or bounces.
- **Focus-visible** is always a 2 px `ring-accent` with `ring-offset-2 ring-offset-bg-primary`. Never remove the ring without replacing it with an equivalent visible affordance.
- **Disabled** is `disabled:opacity-50 disabled:cursor-not-allowed` plus removal of hover/active classes (use `disabled:pointer-events-none` if simpler).

Icon-only buttons: `aria-label` required. Hit target ≥ 36 × 36 px (use `p-2` on a 20 px icon, `p-1.5` on a 24 px icon).

## Spacing rhythm

Stick to Tailwind's 4-px scale. Common rhythms in this codebase:

| Context          | Inner padding   | Gap between children |
| :--------------- | :-------------- | :------------------- |
| Card body        | `p-4` / `p-5`   | `gap-3` / `gap-4`    |
| Form row         | `py-2` / `py-3` | `gap-2`              |
| List row (dense) | `py-2 px-3`     | `gap-2`              |
| Modal body       | `p-6`           | `gap-4` / `gap-6`    |
| Dashboard tile   | `p-5` / `p-6`   | `gap-4`              |

Never `gap-1.5`, never `gap-3.5` — multiples of 2/4/6/8 only.

## Typography

Three IBM Plex families, self-hosted from `public/fonts`:

- `font-heading` is **IBM Plex Sans Condensed**, for page titles, card titles and
  big numbers.
- `font-body` (the default) is **IBM Plex Sans**.
- `font-mono` is **IBM Plex Mono**, for plant codes, unit numbers and IDs set in
  a column.

| Use                   | Class                                                                    |
| :-------------------- | :----------------------------------------------------------------------- |
| Page heading          | `font-heading text-[28px] font-semibold leading-tight text-text-primary` |
| Detail record title   | `font-heading text-[26px] font-semibold leading-tight`                   |
| Card title            | `font-heading text-[15px] font-semibold text-text-primary`               |
| Body                  | `text-sm text-text-primary` (tables use `text-[13px]`)                   |
| Secondary / helper    | `text-sm text-text-secondary`                                            |
| Metric (large number) | `font-heading text-[28px] font-semibold tabular-nums`                    |
| Label                 | `text-xs font-medium text-text-secondary`                                |

No all-caps. Labels, column headings, tabs and buttons are never set in
capitals with wide letter-spacing; new copy is written in sentence case. The
login page is the one place that keeps its own type.

Use `tabular-nums` on every numeric column so values align vertically.

## Patterns

These are the shapes the redesign settled on. Reach for them before inventing
a new one.

- **Shell:** a dark left rail tinted with the user's accent
  (`sidebarBackground(accent)` in `NavigationSidebar.jsx`), grouped into Fleet,
  People and Admin. The page sits on `bg-bg-secondary`.
- **Active nav item:** a lighter fill (`bg-white/[0.11] text-white`). No accent
  bar on the edge, no check mark, no icon tile.
- **Menus, pickers and sub-navs:** plain rows. The selected row takes
  `bg-bg-tertiary` and medium weight. Don't add a check, a coloured stripe on
  the edge, an accent tint or an icon in a rounded square.
- **Switchers:** joined buttons in one `border-border-medium` outline; the
  chosen one is pressed in (`bg-bg-tertiary`, medium weight). No accent-filled
  pill.
- **Dialogs:** every dialog (forms, pickers, confirmations) sits in
  `ui/Dialog.jsx`: a line of context above
  the title, the title in `font-heading` at 20 px, a close button, an optional
  strip for search and filters, a scrolling body, and Cancel then the main
  action at the bottom right. No icon tile beside the title. Pickers and
  lists inside a dialog use ruled rows; the selected row is shaded.
- **Page header:** `ui/PageHeader.jsx`: title, a line of meta, actions on the
  right, then underline tabs.
- **Tabs:** underline tabs (`ui/TabButton.jsx`): a 2 px bar under the active
  tab in `text-primary`, no pill.
- **Buttons:** `.btn-secondary` (bordered), `.btn-primary` (accent fill) and
  `.btn-danger`, all 36 px tall. One primary per view.
- **KPI strip:** `ui/Panel.jsx` `StatGroup`: hairline-ruled cells, label above a
  condensed number. No icon per stat.
- **Detail views:** a record page: Back link, title, actions, underline tabs,
  then cards in a 1240 px column. Save is primary, Delete is danger.
- **Counts:** `CountBubble.jsx`, a solid bubble. Not a grey tag.

## Inputs

Dropdowns, selects, comboboxes, autocomplete, search bars, tooltips, hover messages, date pickers, and time inputs share one contract:

- Surface-aware: a select inside a card uses `bg-bg-primary`; inside a modal it uses `bg-bg-secondary`. The control inverts cleanly in both themes.
- Calendar popovers use `bg-bg-secondary border-border-light shadow-modal rounded-card`.
- Time inputs are forgiving — accept "8", "8a", "830", "8:30 PM" — and detect 12 vs 24 h from the user's preference, not the locale.
- Tooltips: `bg-text-primary text-bg-primary text-xs px-2 py-1 rounded-md shadow-sm` with `animate-fade-in-fast` and an 80 ms delay.

The native `<select>` chevron is stripped with `appearance-none` and redrawn as an inline SVG on `currentColor`, so the affordance follows the text colour across both themes instead of falling back to the browser's own arrow. `src/app/constants/detailFormClasses.js` carries the canonical class string for detail-view forms.

## Two-theme test

Before declaring any visual change done, verify:

- **Light theme:** text contrast ≥ 4.5:1 against the background.
- **Dark theme:** shadows still read; borders not invisible.

If a change uses raw palette tokens (`bg-white`, `bg-gray-100`, `text-gray-500`), it fails the test. Use semantic tokens (`bg-bg-primary`, `text-text-secondary`).

<br />

<p align="center">
  <sub>One vocabulary. Read it before you touch a pixel.</sub>
</p>
