# SkillDrill

**Read the patterns, then drill the problems.**

A study site for interview preparation, built with Vite + React + Material UI.

The app home page is a **track picker** — nothing else. Each track owns its own
home page, its own headline copy and its own navigation.

The **Data Structures & Algorithms** track is complete: 21 chapters, 106 named patterns and 459
curated problems, written as a textbook rather than a link dump. Java & Spring
Boot and System Design are registered tracks with published outlines, waiting on
chapters.

## Running it

```bash
npm install
npm run dev      # http://localhost:5175
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## How it is put together

```
src/
  content/
    tracks.js         the track registry: tile copy, hero copy, planned outlines
    index.js          aggregates every topic, derives tiers/patterns/problems/stats
    topics/*.js       one file per chapter — this is where all the writing lives
  components/
    Blocks.jsx        renders a chapter's content blocks (prose, code, tables, callouts…)
    Inline.jsx        tiny inline-markdown parser: **bold**, _italic_, `code`, [links](url)
    CodeBlock.jsx     Prism-highlighted code with a copy button
    PatternCard.jsx   the "when to apply this" card used on chapters and the pattern index
    ProblemTable.jsx  filterable problem list with progress checkboxes
    TopicCard.jsx     chapter card with per-topic progress
    AppShell.jsx      top bar, mobile drawer, theme toggle, footer
    PageHeader.jsx    shared page hero with breadcrumbs and chips
  pages/              Home (track picker), DsaHome (track landing page),
                      Chapters, TopicPage, PatternsIndex, ProblemsIndex,
                      CheatSheet, Roadmap, TrackOutline, NotFound
  lib/
    navigation.js     two-level nav config: tracks (global) + per-track sections
    anchors.js        shared anchor ids so pages can deep-link into each other
    ColorMode.jsx     light/dark with a localStorage preference
    progress.js       solved-problem tracking (localStorage + a small pub/sub)
    icons.jsx         string -> MUI icon registry used by topic metadata
```

## Page hierarchy

Three levels, each with a distinct job:

```
/                     app home — a filterable picker over the tracks, nothing else
/dsa                  track home — hero, ways in, study habits, the four tiers
/dsa/chapters         the chapter index, grouped by tier, with search
/dsa/<chapter>        a chapter
/dsa/patterns         pattern index across every chapter
/dsa/problems         problem tracker across every chapter
/dsa/cheatsheet       one-page revision reference
/dsa/roadmap          12-week study plan
/spring               track home (planned outline)
/system-design        track home (planned outline)
```

The app home knows nothing about DSA, and the DSA home is not the chapter list —
it links to it. Tier cards on the track home deep-link to
`/dsa/chapters#tier-<name>`; the anchor id is built by `lib/anchors.js` so both
pages agree on it.

## Tracks

`src/content/tracks.js` is the single registry. Each entry supplies both the tile
on the app home page and the headline copy on that track's own home page:

```js
{
  id, to, title, icon, color, status, ready,
  navLabel: '',                      // short form for nav tabs and breadcrumbs
  tags:    [],                       // searched by the home-page filter
  blurb:   '',                       // tile body
  bullets: [],                       // tile highlights
  hero:    { eyebrow, headline: ['line one', 'line two'], lead },
  outline: [{ group, items: [] }],   // planned tracks only
}
```

A track with an `outline` and no chapters renders through the shared
`TrackOutline` page, so adding a track is a registry entry plus one route. A
track that gains real content gets its own page (as DSA has) and registers its
tabs in `TRACK_SECTIONS`.

Track-specific copy deliberately lives here rather than on the app home page —
the home page reads the registry and knows nothing about DSA.

Nothing hard-codes a track's name. `trackLabel(id)` and `trackCrumb(id)` are the
only ways a track is named in the UI, so renaming one is a single edit here.

## Navigation

Navigation is deliberately two levels, both declared in `src/lib/navigation.js`:

- **`TRACKS`** is the global bar — one entry per track (Home, DSA, Java &
  Spring Boot, System Design), labelled with each track's `navLabel`. It never
  grows as a track gains pages.
- **`TRACK_SECTIONS`** holds each track's own pages. They render in a second bar
  that only appears while you are inside that track, so DSA tools (Patterns,
  Problems, Cheat Sheet, Roadmap) do not show on the home page or on another
  track's pages.

To give a new track its own tabs, add an entry to `TRACK_SECTIONS` with a
`prefix` and its `items`; the second bar appears on its own. An item marked
`fallback: true` is highlighted whenever nothing else in the section matches —
that is how a chapter page keeps *Chapters* selected.

`AppShell` toggles a `.mh-has-subnav` class on `<body>`, and `src/index.css`
turns that into a `--mh-header` variable. Anchor scroll offsets and the sticky
chapter TOC are derived from it, so they stay correct whether or not the second
bar is showing.

## Adding a chapter

Create `src/content/topics/<id>.js` exporting a default object, then add it to the
two lists in `src/content/index.js`. Nothing else needs to change — the chapter
page, pattern index, problem tracker, cheat sheet and roadmap all read from the
same data.

```js
export default {
  id, title, short, icon, tier, order, estHours, prereqs: [],
  tagline, mentalModel, whyItMatters,
  complexity: [{ op, time, space, note }],
  sections:   [{ id, title, blocks: [ /* see block types below */ ] }],
  patterns:   [{ id, name, oneLiner, useWhen, recognize, steps,
                 template: { lang, code, caption }, complexity, gotchas, problems }],
  pitfalls:   [{ title, text }],
  cheatsheet: [{ label, value }],
  problems:   [{ name, difficulty, url, pattern, insight }],
}
```

### Content block types

| `t`        | Fields                          | Renders as                              |
|------------|---------------------------------|-----------------------------------------|
| `p`        | `text`                          | Paragraph                               |
| `lead`     | `text`                          | Larger intro paragraph                  |
| `h`        | `text`                          | Sub-heading inside a section            |
| `ul` / `ol`| `items[]`                       | Bulleted / numbered list                |
| `code`     | `code`, `lang`, `caption`       | Highlighted code block with copy button |
| `ascii`    | `code`, `caption`               | Monospace diagram                       |
| `table`    | `head[]`, `rows[][]`, `caption` | Data table                              |
| `steps`    | `items[{title, text}]`          | Numbered step list                      |
| `dl`       | `items[{term, def}]`            | Definition list                         |
| `compare`  | `left{title,items}`, `right{…}` | Two-column do/don't comparison          |
| `tags`     | `items[]`                       | Chip row                                |
| `key` `tip` `warn` `note` `trap` | `title`, `text`  | Coloured callout                        |

Inside any text field you can use `**bold**`, `_italic_`, `` `code` `` and
`[label](https://url)`.

## Notes

- Progress (ticked-off problems) and the light/dark preference are stored in
  `localStorage` — they are per-browser and never leave the machine.
- `tier` must be one of `Foundations`, `Core`, `Advanced`, `Elite`; `icon` must be
  a key in `src/lib/icons.jsx`.
- `order` controls both the chapter number and the previous/next navigation.
