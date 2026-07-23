/* Font registry. Every font JSON was converted from a properly-licensed
   single-line SVG font (SIL OFL or the Hershey free-use license) and already
   contains a complete character set — letters, digits, and punctuation —
   normalized to a 20-unit em (EM_UNITS below), so no font ever falls back to
   a placeholder glyph for ordinary text. */

const EM_UNITS = 20; // glyph paths are authored so cap-height = 20 units

const Fonts = {
  manifest: null,
  byId: {},
  ready: false,

  async loadAll(basePath = 'fonts/') {
    const manifestRes = await fetch(basePath + 'manifest.json');
    this.manifest = await manifestRes.json();

    const loads = this.manifest.fonts.map(async (entry) => {
      try {
        const res = await fetch(basePath + entry.file);
        const data = await res.json();
        this.byId[entry.id] = {
          id: entry.id,
          name: entry.name,
          category: entry.category,
          derivative: entry.derivative,
          license: entry.license,
          characters: data.characters,
          fallback: data.fallback,
          metrics: data.metrics || { emUnits: 20, topUnits: 0, baselineUnits: 20, bottomUnits: 26 },
        };
      } catch (err) {
        console.error('Failed to load font', entry.name, err);
      }
    });

    await Promise.all(loads);
    this.ready = true;
    return this.list();
  },

  list() {
    if (!this.manifest) return [];
    return this.manifest.fonts
      .map(e => this.byId[e.id])
      .filter(Boolean);
  },

  get(id) {
    return this.byId[id] || this.list()[0];
  },

  glyph(fontId, ch) {
    const font = this.get(fontId);
    if (!font) return { path: '', width: 10 };
    return font.characters[ch] || font.fallback;
  },

  /* Measures a single line of text at the font's native 20-unit em.
     Multiply the result by (sizeMM / EM_UNITS) to get physical mm. */
  measureLine(fontId, text, letterSpacingUnits, wordSpacingUnits) {
    const font = this.get(fontId);
    let width = 0;
    for (const ch of text) {
      if (ch === ' ') { width += wordSpacingUnits; continue; }
      const g = font.characters[ch] || font.fallback;
      width += g.width + letterSpacingUnits;
    }
    return width;
  },

  /* Builds a small standalone SVG string previewing the font's own name,
     used for the font-picker grid. */
  previewSVG(fontId, text, { width = 220, height = 56, stroke = '#1A2233' } = {}) {
    const font = this.get(fontId);
    if (!font) return '';
    let x = 4;
    const parts = [];
    for (const ch of text) {
      if (ch === ' ') { x += 6; continue; }
      const g = font.characters[ch] || font.fallback;
      if (g.path) {
        parts.push(`<path d="${g.path}" transform="translate(${x},0)" />`);
      }
      x += g.width + 1.5;
    }
    const scale = Math.min((width - 8) / Math.max(x, 1), 1.6);
    const vbH = 32;
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">` +
      `<g transform="translate(4 ${height / 2 + vbH * scale / 2 - 2}) scale(${scale})" ` +
      `fill="none" stroke="${stroke}" stroke-width="${1.4 / scale}" stroke-linecap="round" stroke-linejoin="round">` +
      parts.join('') + `</g></svg>`;
  },
};
