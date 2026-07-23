# Plotter Studio

Compose text, pick from 18 licensed single-line typefaces, scale it to real
paper or card stock, and export a plotter-ready SVG — sized in true
millimeters so it converts cleanly to GCode in your plotter software of
choice.

## Features

- **Multiple text boxes** — add as many as you like, drag them anywhere on
  the page, and style each independently.
- **18 single-line fonts** — handwritten, script, technical, and classic
  engraving styles. Every font has a complete character set (letters,
  digits, punctuation) — nothing is a trial/demo glyph.
- **Real paper sizes** — Letter, Legal, A4–A6, index cards, note cards,
  thank-you cards, or a custom size, in millimeters or inches (toggle any
  time — the file is always exported in millimeters for accurate GCode
  conversion downstream).
- **Fit to margins** — auto-scales and centers a text box within the page
  margins.
- **Hand-drawn controls** — rotation, slant/italics, letter/word spacing,
  line height, underline/strikethrough, jitter, and baseline wobble.
- **Multi-pen support** — assign each text box a pen color/label and pen
  width; the exported SVG tags each group with `data-pen` so a downstream
  GCode tool can separate passes per pen.
- **Registration marks** — optional corner crosshairs for aligning paper on
  the plotter bed, on-screen or in the export.
- **Project files** — save/load your layout as a `.json` file (no account,
  no server — just a local file).

## Running it locally

This is a static site — no build step, no dependencies to install. Because
the app loads font data with `fetch()`, opening `index.html` directly
(`file://`) will be blocked by the browser's CORS rules. Serve it locally
instead, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

or any equivalent (`npx serve`, VS Code's Live Server extension, etc.).

## Hosting on GitHub Pages

1. Push this folder to a GitHub repository.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch",
   pick your branch (e.g. `main`) and the `/ (root)` folder.
4. Save — GitHub will publish it at `https://<username>.github.io/<repo>/`
   within a minute or two.

No build step is required; the site is plain HTML/CSS/JS.

## Project structure

```
index.html            App shell
css/styles.css         Design tokens + all component styles
js/paper-sizes.js      Paper/card presets (mm) + unit conversion helpers
js/fonts.js             Font registry: loads fonts/manifest.json + each font JSON
js/state.js             App state, text-block model, project save/load
js/render.js             SVG layout engine (screen canvas + clean export)
js/ui.js                 DOM wiring: panels, drag/select, rulers, export
js/main.js               Boot sequence
fonts/*.json             18 converted single-line fonts
fonts/manifest.json      Font metadata (name, category, license credit)
```

### How sizing works

Every measurement in `AppState` (block position, letter height, spacing,
page dimensions, margins) is stored in **millimeters**, regardless of which
unit the UI is displaying. The mm/in toggle only affects how numbers are
*shown* and *entered* — it never touches the underlying model. The exported
SVG's `viewBox` and `width`/`height` attributes are always in millimeters,
so opening it in Inkscape, Illustrator, or a GCode conversion tool yields
the exact physical size you designed at.

Each font's glyph paths are normalized so a letter's cap-height is exactly
20 units. A text box's `sizeMM` (letter height) maps 20 units → `sizeMM`
millimeters — so switching fonts on a block keeps the same physical letter
height.

## Fonts & licensing

All 18 fonts are single-line ("pen plotter") fonts converted from the
archive curated by Evil Mad Scientist Labs for exactly this use case:
<https://github.com/golanlevin/p5-single-line-font-resources>

Every font is released under the **SIL Open Font License 1.1** or the
**Hershey Fonts free-use license** (the Hershey fonts are public-domain-era
vector fonts created by Dr. A. V. Hershey at the U.S. National Bureau of
Standards, with a permissive attribution-only license). See
`fonts/manifest.json` for the exact license and original-design credit for
each font. Unlike many "free" single-line fonts distributed as trial
downloads, none of these substitute a watermark glyph for digits or
punctuation — the full, licensed character set is included.

If you add more fonts later, convert them with the same normalization
(cap-height → 20 units, origin at top-left, baseline at y=20) so they drop
into the existing font JSON format. The conversion script used to build
this set parses SVG-font glyphs (`M`/`L`/`C`/`Z` path commands) — ask if you
want it adapted for a new source font.
