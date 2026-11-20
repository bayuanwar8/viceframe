# VICEFRAME — Cinematic Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/bayuanwar8/viceframe/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/bayuanwar8/viceframe/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

VICEFRAME turns your own photos into GTA-style cinematic cover art: a
multi-panel poster with bold condensed lettering and a Vice Coast neon-sunset
grade, exported as a PNG to share. It runs entirely offline in a desktop
browser — your photos never leave your machine.

## What it does

- **Photo Studio** — upload 1–6 photos (drag & drop or browse), reorder them,
  click a photo to place it in the selected panel. Drag a panel's photo to
  move it, scroll to zoom, Alt+click (Set focal point) to centre on a subject.
  Portrait and landscape photos both work.
- **Five original layouts** — Cinematic Hero (one photo, giant type), Vice
  Triptych (three vertical panels), Sunset Mosaic (asymmetric multi-photo),
  Split Cinema (hero + two supports), Editorial Collection (magazine grid).
  Every panel can be selected and edited on its own.
- **Colour grading** — six original presets (Vice Sunset, Neon After Dark,
  Miami Heat, Golden Hour, Tropical Noir, Electric Blue) plus manual controls:
  exposure, contrast, saturation, temperature, highlights, shadows, vignette,
  film grain and halftone. Changes show live in the preview.
- **Typography Studio** — four original type styles (Vice Block, Neon Strip,
  Editorial, Vice Chrome — a retro-chrome 3D title with a gradient fill and
  stacked extrude), editable title, subtitle and supporting text, title size,
  alignment and colour, with stroke and glow built in.
- **Original graphic elements** — a banded sunset disc, palm silhouettes and
  palm clusters, a coastal skyline with lit windows, neon corner accents, a
  film-frame border, issue numbering and a location label, all drawn in code.
- **Poster density** — cast role tags on every panel (the sample photos star
  THE ANGLER, THE DRIVER and THE NIGHT OWL), a movie billing block with the
  credits at the bottom, a pop-out hero that breaks its frame with a soft
  shadow and a neon edge, slanted triptych dividers, a VICEFRAME seal stamp,
  and the Vice Chrome title style. Every one of them is a real toggle in the
  editor, so a cover can be as clean or as busy as you want it.
- **PNG export engine** — re-renders the cover at full resolution (never a
  screenshot of the preview) in 1080 x 1080, 1080 x 1350 and 1920 x 1080,
  one size at a time or all three in one click. Undo/redo included.

## How to run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no install, no account. Any static file server works too:
serve the `app/` folder and open `index.html`.

## How to export a cover

1. Drop a photo (or use the three built-in samples).
2. Pick a layout, a grade and a type style; edit the title.
3. Click a panel to select it, drag its photo into place.
4. Choose an export size and press **Export PNG** (or **Export all 3 sizes**).

## Project structure

```
main.ts            entry program: copies app/ + screenshots/ to /output,
                   writes dossier.json (Node 22 stdlib only)
serve.ts           tiny static server for local tries (port 8080)
vendor/            make.fun library (kit copy, unchanged)
app/
  index.html       the editor (top bar, sidebars, live preview)
  style.css        editor chrome
  fonts/           Bebas Neue + Oswald (SIL Open Font License, see below)
  samples/         two sample photos, made with an image model for make.fun
  src/
    main.js        UI wiring, undo/redo, export engine
    render.js      the cover renderer (panels, grade, elements, type)
    layouts.js     the five layouts (per aspect ratio)
    state.js       project state, grade presets, type styles
    grade.js       grading: filters, tints, vignette, grain, halftone
    elements.js    graphic elements drawn in code
    shots.js       fixed ?shot= scenes for screenshots
screenshots/        1-cover.jpg (the cover), 2-editor.jpg (the editor),
                   3-cover.jpg (a second cover, another grade),
                   4-cover.jpg (a third cover, Split Cinema)
shots.json         the screenshot scenes and their sizes
```

## Asset and font licences

- **Bebas Neue** (display type) — Copyright 2019 The Bebas Neue Project
  Authors, SIL Open Font License 1.1 (`app/fonts/OFL-bebas.txt`).
- **Oswald** (labels and supporting text) — Copyright 2016 The Oswald Project
  Authors, SIL Open Font License 1.1 (`app/fonts/OFL-oswald.txt`).
- **Sample photos** (`app/samples/*.jpg`) — `pier.jpg` and `boulevard.jpg`
  were made with an image model for make.fun, and `neon.jpg` (a neon night
  street portrait) was made with an image model for this entry; all free to
  use.
- Everything else in this repository — the layouts, the grading, the graphic
  elements, the type styles and the code — is original work, MIT licensed
  (see `LICENSE`). No Rockstar Games logo, artwork, character or font is
  used anywhere.

## Screenshots

`?shot=cover` shows a cover alone; `?shot=editor` shows the editor with a
sample photo. Query params: `layout`, `grade`, `size`, `photo`, `caption`,
`subtitle`, `style`, `cast`, `billing`, `popout`, `seal`, `slant`, `tags` —
e.g. `?shot=cover&layout=triptych&grade=neon-after-dark&photo=pier&caption=NEON%20NIGHTS&style=vice-chrome&cast=1&billing=1&popout=1&seal=1&slant=1`.
