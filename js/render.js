/* Rendering engine. Builds the live editable canvas (with selection
   hitboxes and page-editing chrome) and, separately, a clean standalone
   SVG for export — both from the same block-layout math, so what you see
   is exactly what gets plotted. */

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

const Render = {
  canvas: null,

  init(canvasEl) {
    this.canvas = canvasEl;
  },

  /* ---------- layout math (shared by screen + export) ---------- */

  computeBlockMetrics(block) {
    const font = Fonts.get(block.fontId);
    const scale = block.sizeMM / EM_UNITS;
    const rawLines = block.text.length ? block.text.split('\n') : [''];

    const lineData = rawLines.map(line => {
      let widthMM = 0;
      const chars = [];
      for (const ch of line) {
        if (ch === ' ') {
          chars.push({ ch, isSpace: true, advance: block.wordSpacingMM });
          widthMM += block.wordSpacingMM;
          continue;
        }
        const g = font.characters[ch] || font.fallback;
        const advance = g.width * scale + block.letterSpacingMM;
        chars.push({ ch, glyph: g, advance });
        widthMM += advance;
      }
      return { raw: line, chars, widthMM };
    });

    const widthMM = Math.max(0, ...lineData.map(l => l.widthMM));
    const m = font.metrics;
    const heightMM = (rawLines.length - 1) * block.lineHeightMM + (m.bottomUnits - m.topUnits) * scale;

    return { lineData, widthMM: widthMM, heightMM: Math.max(0, heightMM), scale, font };
  },

  /* ---------- block group (used for both screen + export) ---------- */

  buildBlockGroup(block, { interactive = false, selected = false } = {}) {
    const metrics = this.computeBlockMetrics(block);
    block._widthMM = metrics.widthMM;
    block._heightMM = metrics.heightMM;

    const g = svgEl('g', {
      'data-id': block.id,
      'data-pen': block.penLabel,
      class: 'block-group' + (interactive ? ' interactive' : '') + (selected ? ' selected' : ''),
    });

    const cx = metrics.widthMM / 2;
    const cy = metrics.heightMM / 2;
    g.setAttribute('transform', `translate(${block.x} ${block.y}) rotate(${block.rotation || 0} ${cx} ${cy})`);

    if (interactive) {
      const hit = svgEl('rect', {
        class: 'hitbox',
        x: -4, y: -4,
        width: metrics.widthMM + 8,
        height: metrics.heightMM + 8,
      });
      g.appendChild(hit);
    }

    let currentY = -metrics.font.metrics.topUnits * metrics.scale;
    // shift down so the top-most ascender extent starts at y=0 within the group

    metrics.lineData.forEach(line => {
      let currentX = 0;
      if (block.align === 'center') currentX = (metrics.widthMM - line.widthMM) / 2;
      if (block.align === 'right') currentX = (metrics.widthMM - line.widthMM);
      const lineStartX = currentX;

      if (block.underline) {
        const y = currentY + 22 * metrics.scale;
        g.appendChild(svgEl('line', {
          x1: lineStartX, y1: y, x2: lineStartX + line.widthMM, y2: y,
          stroke: block.penColor, 'stroke-width': block.strokeWidthMM, 'stroke-linecap': 'round',
        }));
      }
      if (block.strikethrough) {
        const y = currentY + 10 * metrics.scale;
        g.appendChild(svgEl('line', {
          x1: lineStartX, y1: y, x2: lineStartX + line.widthMM, y2: y,
          stroke: block.penColor, 'stroke-width': block.strokeWidthMM, 'stroke-linecap': 'round',
        }));
      }

      line.chars.forEach(c => {
        if (c.isSpace) { currentX += c.advance; return; }
        const wobbleY = block.wobbleMM > 0 ? (Math.random() * block.wobbleMM - block.wobbleMM / 2) : 0;
        let randScale = 1, randRotate = 0, jitterX = 0;
        if (block.jitter > 0) {
          randScale += (Math.random() * 0.04 - 0.02) * block.jitter;
          randRotate = (Math.random() - 0.5) * block.jitter;
          jitterX = (Math.random() - 0.5) * 0.05 * block.jitter;
        }
        if (c.glyph.path) {
          const path = svgEl('path', { d: c.glyph.path, fill: 'none', stroke: block.penColor });
          // The glyph's own transform includes scale(), which would also scale
          // stroke-width. Divide it out first so the pen width stays constant
          // in physical mm regardless of letter size.
          path.setAttribute('stroke-width', block.strokeWidthMM / (metrics.scale * randScale));
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('stroke-linejoin', 'round');
          path.setAttribute('transform',
            `translate(${currentX} ${currentY + wobbleY}) scale(${metrics.scale * randScale}) skewX(${block.slant}) rotate(${randRotate})`);
          g.appendChild(path);
        }
        currentX += c.advance + jitterX;
      });

      currentY += block.lineHeightMM;
    });

    return g;
  },

  /* ---------- screen canvas (page chrome + interactive blocks) ---------- */

  updateCanvasSize() {
    const { widthMM: w, heightMM: h } = AppState.page;
    this.canvas.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.canvas.style.width = (w * PX_PER_MM * AppState.zoom) + 'px';
    this.canvas.style.height = (h * PX_PER_MM * AppState.zoom) + 'px';
  },

  renderCanvas() {
    this.updateCanvasSize();
    const svg = this.canvas;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const { widthMM: w, heightMM: h, marginMM } = AppState.page;

    svg.appendChild(this.buildDefs());

    svg.appendChild(svgEl('rect', { x: 0, y: 0, width: w, height: h, class: 'page-bg' }));

    if (AppState.page.showGrid) {
      svg.appendChild(svgEl('rect', { x: 0, y: 0, width: w, height: h, fill: 'url(#gridPattern)' }));
    }

    if (AppState.page.showMargins && marginMM > 0) {
      svg.appendChild(svgEl('rect', {
        x: marginMM, y: marginMM, width: Math.max(0, w - 2 * marginMM), height: Math.max(0, h - 2 * marginMM),
        class: 'margin-guide',
      }));
    }

    if (AppState.page.showRegistration) {
      svg.appendChild(this.buildRegistrationMarks(w, h));
    }

    AppState.blocks.forEach(block => {
      const selected = block.id === AppState.selectedBlockId;
      const g = this.buildBlockGroup(block, { interactive: true, selected });
      if (this.isOutOfBounds(block, w, h)) g.classList.add('out-of-bounds');
      svg.appendChild(g);
    });
  },

  isOutOfBounds(block, pageW, pageH) {
    return block.x < 0 || block.y < 0 ||
      block.x + block._widthMM > pageW ||
      block.y + block._heightMM > pageH;
  },

  buildDefs() {
    const defs = svgEl('defs');
    const pattern = svgEl('pattern', {
      id: 'gridPattern', width: 10, height: 10, patternUnits: 'userSpaceOnUse',
    });
    pattern.appendChild(svgEl('path', { d: 'M10,0 L0,0 L0,10', class: 'grid-line' }));
    defs.appendChild(pattern);
    return defs;
  },

  buildRegistrationMarks(w, h) {
    const g = svgEl('g', { class: 'registration' });
    const inset = 4, len = 3;
    const corners = [[inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset]];
    corners.forEach(([cx, cy]) => {
      g.appendChild(svgEl('line', { x1: cx - len, y1: cy, x2: cx + len, y2: cy }));
      g.appendChild(svgEl('line', { x1: cx, y1: cy - len, x2: cx, y2: cy + len }));
      g.appendChild(svgEl('circle', { cx, cy, r: len * 0.6, fill: 'none' }));
    });
    return g;
  },

  /* ---------- export ---------- */

  buildExportSVG({ includeRegistration = false } = {}) {
    const { widthMM: w, heightMM: h } = AppState.page;
    const svg = svgEl('svg', {
      viewBox: `0 0 ${w} ${h}`,
      width: `${w}mm`,
      height: `${h}mm`,
    });

    if (includeRegistration) {
      const marks = this.buildRegistrationMarks(w, h);
      marks.setAttribute('stroke', '#999999');
      marks.setAttribute('stroke-width', '0.15');
      marks.setAttribute('fill', 'none');
      svg.appendChild(marks);
    }

    AppState.blocks.forEach(block => {
      svg.appendChild(this.buildBlockGroup(block, { interactive: false }));
    });

    return new XMLSerializer().serializeToString(svg);
  },

  /* ---------- fit-to-page ---------- */

  fitBlockToMargins(block) {
    const { widthMM: w, heightMM: h, marginMM } = AppState.page;
    const availW = Math.max(1, w - 2 * marginMM);
    const availH = Math.max(1, h - 2 * marginMM);
    const before = this.computeBlockMetrics(block);
    if (before.widthMM <= 0 || before.heightMM <= 0) return;

    const factor = Math.min(availW / before.widthMM, availH / before.heightMM);
    if (!isFinite(factor) || factor <= 0) return;

    block.sizeMM *= factor;
    block.letterSpacingMM *= factor;
    block.wordSpacingMM *= factor;
    block.lineHeightMM *= factor;
    block.wobbleMM *= factor;

    const after = this.computeBlockMetrics(block);
    block.x = marginMM + (availW - after.widthMM) / 2;
    block.y = marginMM + (availH - after.heightMM) / 2;
  },

  centerBlockOnPage(block) {
    const { widthMM: w, heightMM: h } = AppState.page;
    const m = this.computeBlockMetrics(block);
    block.x = (w - m.widthMM) / 2;
    block.y = (h - m.heightMM) / 2;
  },

  /* ---------- pointer coordinate helper ---------- */

  screenToMM(evt) {
    const pt = this.canvas.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(this.canvas.getScreenCTM().inverse());
  },
};
