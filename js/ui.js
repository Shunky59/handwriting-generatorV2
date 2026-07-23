/* UI layer. Reads/writes AppState, calls Render, and re-renders whichever
   parts of the DOM need to change. Kept deliberately simple (no framework)
   since this ships as a static, no-build GitHub Pages site. */

const UI = {
  el: {},

  init() {
    this.cacheEls();
    this.populatePaperSelect();
    this.wireTabs();
    this.wireBlockList();
    this.wireStylePanel();
    this.wirePagePanel();
    this.wireCanvasInteraction();
    this.wireZoom();
    this.wireUnitsToggle();
    this.buildFontGrid();

    applyPagePreset(AppState.page.presetId);
    if (!AppState.blocks.length) addBlock();

    this.renderAll();
  },

  cacheEls() {
    const ids = [
      'blockList', 'addBlockBtn', 'styleEmpty', 'styleBody', 'fontGrid', 'fontCount',
      'fitMarginsBtn', 'centerPageBtn',
      'sizeInput', 'sizeReadout', 'letterSpacingInput', 'letterSpacingReadout',
      'wordSpacingInput', 'wordSpacingReadout', 'lineHeightInput', 'lineHeightReadout',
      'underlineInput', 'strikethroughInput', 'italicsInput',
      'rotationInput', 'rotationReadout', 'slantInput', 'slantReadout',
      'jitterInput', 'jitterReadout', 'wobbleInput', 'wobbleReadout',
      'penColorInput', 'penLabelInput', 'strokeWidthInput', 'strokeWidthReadout',
      'paperSelect', 'pageWidthInput', 'pageHeightInput', 'marginInput',
      'showGridInput', 'showMarginsInput', 'showRegInput', 'exportRegInput', 'exportBtn',
      'saveProjectBtn', 'loadProjectBtn', 'loadProjectInput',
      'pageLabel', 'zoomOutBtn', 'zoomInBtn', 'zoomFitBtn', 'zoomLabel',
      'viewport', 'surface', 'canvas', 'rulerTop', 'rulerLeft',
    ];
    ids.forEach(id => { this.el[id] = document.getElementById(id); });
    Render.init(this.el.canvas);
  },

  renderAll() {
    Render.renderCanvas();
    this.renderBlockList();
    this.renderStylePanel();
    this.updatePageLabel();
    this.updateRulers();
    this.updateZoomLabel();
  },

  /* ---------------- units ---------------- */

  toDisplay(mm) { return AppState.units === 'mm' ? mm : mmToIn(mm); },
  fromDisplay(v) { return AppState.units === 'mm' ? v : inToMm(v); },

  fmt(mm, decimals) {
    const unit = AppState.units;
    const d = decimals ?? (unit === 'mm' ? 1 : 2);
    return `${this.toDisplay(mm).toFixed(d)}${unit}`;
  },

  wireUnitsToggle() {
    document.querySelectorAll('.unit-toggle [data-unit]').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.units = btn.dataset.unit;
        document.querySelectorAll('.unit-toggle [data-unit]').forEach(b => b.classList.toggle('active', b === btn));
        this.renderAll();
      });
    });
  },

  /* ---------------- tabs ---------------- */

  wireTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab); });
        document.querySelectorAll('.panel').forEach(p => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
      });
    });
  },

  showStyleTab() {
    document.querySelector('.tab[data-tab="style"]').click();
  },

  /* ---------------- block list (Text tab) ---------------- */

  wireBlockList() {
    this.el.addBlockBtn.addEventListener('click', () => {
      const b = addBlock();
      Render.centerBlockOnPage(b);
      this.renderAll();
    });
  },

  renderBlockList() {
    const list = this.el.blockList;
    list.innerHTML = '';
    AppState.blocks.forEach((block, index) => {
      const card = document.createElement('div');
      card.className = 'block-card' + (block.id === AppState.selectedBlockId ? ' active' : '');
      card.innerHTML = `
        <div class="block-card__head">
          <span class="block-card__title">Box ${index + 1}</span>
          ${AppState.blocks.length > 1 ? '<button class="icon-btn icon-btn--danger" data-action="remove" type="button" aria-label="Remove box">✕</button>' : ''}
        </div>
        <textarea rows="3" data-action="text" placeholder="Type your message…">${escapeHTML(block.text)}</textarea>
        <div class="block-card__row">
          <label class="field-label field-label--tight">Align
            <select data-action="align" class="select select--sm">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
        </div>
        <div class="block-card__row">
          <label class="field-label field-label--tight">X<input type="number" step="0.1" data-action="x"></label>
          <label class="field-label field-label--tight">Y<input type="number" step="0.1" data-action="y"></label>
        </div>
      `;
      card.querySelector('[data-action="align"]').value = block.align;
      card.querySelector('[data-action="x"]').value = this.toDisplay(block.x).toFixed(2);
      card.querySelector('[data-action="y"]').value = this.toDisplay(block.y).toFixed(2);

      card.addEventListener('click', (e) => {
        if (['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName)) return;
        selectBlock(block.id);
        this.renderAll();
      });
      card.querySelector('[data-action="remove"]')?.addEventListener('click', () => {
        removeBlock(block.id);
        this.renderAll();
      });
      card.querySelector('[data-action="text"]').addEventListener('input', (e) => {
        block.text = e.target.value;
        if (AppState.selectedBlockId !== block.id) selectBlock(block.id);
        Render.renderCanvas();
        this.syncBlockCardActive();
      });
      card.querySelector('[data-action="align"]').addEventListener('change', (e) => {
        block.align = e.target.value;
        Render.renderCanvas();
      });
      card.querySelector('[data-action="x"]').addEventListener('input', (e) => {
        block.x = this.fromDisplay(parseFloat(e.target.value) || 0);
        Render.renderCanvas();
      });
      card.querySelector('[data-action="y"]').addEventListener('input', (e) => {
        block.y = this.fromDisplay(parseFloat(e.target.value) || 0);
        Render.renderCanvas();
      });

      list.appendChild(card);
    });
  },

  syncBlockCardActive() {
    // lightweight refresh of the active-card highlight without rebuilding textareas (avoids caret jumps)
    [...this.el.blockList.children].forEach((card, i) => {
      card.classList.toggle('active', AppState.blocks[i]?.id === AppState.selectedBlockId);
    });
  },

  /* ---------------- style panel ---------------- */

  wireStylePanel() {
    const b = () => getSelectedBlock();
    const bindSlider = (input, readoutId, mmGetSet, formatFn) => {
      input.addEventListener('input', () => {
        const block = b(); if (!block) return;
        mmGetSet.set(block, parseFloat(input.value));
        this.el[readoutId].textContent = formatFn(mmGetSet.get(block));
        Render.renderCanvas();
        this.updateBlockCardXY();
      });
    };

    bindSlider(this.el.sizeInput, 'sizeReadout',
      { get: bl => bl.sizeMM, set: (bl, v) => bl.sizeMM = v }, mm => this.fmt(mm, 1));
    bindSlider(this.el.letterSpacingInput, 'letterSpacingReadout',
      { get: bl => bl.letterSpacingMM, set: (bl, v) => bl.letterSpacingMM = v }, mm => this.fmt(mm, 2));
    bindSlider(this.el.wordSpacingInput, 'wordSpacingReadout',
      { get: bl => bl.wordSpacingMM, set: (bl, v) => bl.wordSpacingMM = v }, mm => this.fmt(mm, 2));
    bindSlider(this.el.lineHeightInput, 'lineHeightReadout',
      { get: bl => bl.lineHeightMM, set: (bl, v) => bl.lineHeightMM = v }, mm => this.fmt(mm, 1));
    bindSlider(this.el.wobbleInput, 'wobbleReadout',
      { get: bl => bl.wobbleMM, set: (bl, v) => bl.wobbleMM = v }, mm => this.fmt(mm, 2));
    bindSlider(this.el.strokeWidthInput, 'strokeWidthReadout',
      { get: bl => bl.strokeWidthMM, set: (bl, v) => bl.strokeWidthMM = v }, mm => `${mm.toFixed(2)}mm`);

    this.el.rotationInput.addEventListener('input', () => {
      const block = b(); if (!block) return;
      block.rotation = parseFloat(this.el.rotationInput.value);
      this.el.rotationReadout.textContent = `${block.rotation}°`;
      Render.renderCanvas();
    });
    this.el.slantInput.addEventListener('input', () => {
      const block = b(); if (!block) return;
      block.slant = parseFloat(this.el.slantInput.value);
      block.italics = block.slant !== 0;
      this.el.italicsInput.checked = block.italics;
      this.el.slantReadout.textContent = `${block.slant}°`;
      Render.renderCanvas();
    });
    this.el.jitterInput.addEventListener('input', () => {
      const block = b(); if (!block) return;
      block.jitter = parseFloat(this.el.jitterInput.value);
      this.el.jitterReadout.textContent = block.jitter.toFixed(1);
      Render.renderCanvas();
    });

    this.el.underlineInput.addEventListener('change', () => { const bl = b(); if (bl) { bl.underline = this.el.underlineInput.checked; Render.renderCanvas(); } });
    this.el.strikethroughInput.addEventListener('change', () => { const bl = b(); if (bl) { bl.strikethrough = this.el.strikethroughInput.checked; Render.renderCanvas(); } });
    this.el.italicsInput.addEventListener('change', () => {
      const block = b(); if (!block) return;
      block.italics = this.el.italicsInput.checked;
      block.slant = block.italics ? -12 : 0;
      this.el.slantInput.value = block.slant;
      this.el.slantReadout.textContent = `${block.slant}°`;
      Render.renderCanvas();
    });

    this.el.penColorInput.addEventListener('input', () => { const bl = b(); if (bl) { bl.penColor = this.el.penColorInput.value; Render.renderCanvas(); } });
    this.el.penLabelInput.addEventListener('input', () => { const bl = b(); if (bl) { bl.penLabel = this.el.penLabelInput.value || 'Pen'; Render.renderCanvas(); } });

    this.el.fitMarginsBtn.addEventListener('click', () => {
      const block = b(); if (!block) return;
      Render.fitBlockToMargins(block);
      this.renderAll();
    });
    this.el.centerPageBtn.addEventListener('click', () => {
      const block = b(); if (!block) return;
      Render.centerBlockOnPage(block);
      this.renderAll();
    });
  },

  updateBlockCardXY() {
    const block = getSelectedBlock();
    if (!block) return;
    const idx = AppState.blocks.findIndex(bl => bl.id === block.id);
    const card = this.el.blockList.children[idx];
    if (!card) return;
    card.querySelector('[data-action="x"]').value = this.toDisplay(block.x).toFixed(2);
    card.querySelector('[data-action="y"]').value = this.toDisplay(block.y).toFixed(2);
  },

  renderStylePanel() {
    const block = getSelectedBlock();
    if (!block) {
      this.el.styleEmpty.hidden = false;
      this.el.styleBody.hidden = true;
      return;
    }
    this.el.styleEmpty.hidden = true;
    this.el.styleBody.hidden = false;

    this.el.sizeInput.value = block.sizeMM; this.el.sizeReadout.textContent = this.fmt(block.sizeMM, 1);
    this.el.letterSpacingInput.value = block.letterSpacingMM; this.el.letterSpacingReadout.textContent = this.fmt(block.letterSpacingMM, 2);
    this.el.wordSpacingInput.value = block.wordSpacingMM; this.el.wordSpacingReadout.textContent = this.fmt(block.wordSpacingMM, 2);
    this.el.lineHeightInput.value = block.lineHeightMM; this.el.lineHeightReadout.textContent = this.fmt(block.lineHeightMM, 1);
    this.el.wobbleInput.value = block.wobbleMM; this.el.wobbleReadout.textContent = this.fmt(block.wobbleMM, 2);
    this.el.strokeWidthInput.value = block.strokeWidthMM; this.el.strokeWidthReadout.textContent = `${block.strokeWidthMM.toFixed(2)}mm`;
    this.el.rotationInput.value = block.rotation; this.el.rotationReadout.textContent = `${block.rotation}°`;
    this.el.slantInput.value = block.slant; this.el.slantReadout.textContent = `${block.slant}°`;
    this.el.jitterInput.value = block.jitter; this.el.jitterReadout.textContent = block.jitter.toFixed(1);
    this.el.underlineInput.checked = block.underline;
    this.el.strikethroughInput.checked = block.strikethrough;
    this.el.italicsInput.checked = block.italics;
    this.el.penColorInput.value = block.penColor;
    this.el.penLabelInput.value = block.penLabel;

    document.querySelectorAll('.font-card').forEach(card => {
      card.classList.toggle('active', card.dataset.fontId === block.fontId);
    });
  },

  buildFontGrid() {
    const fonts = Fonts.list();
    this.el.fontCount.textContent = `${fonts.length} licensed`;
    this.el.fontGrid.innerHTML = '';
    fonts.forEach(font => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'font-card';
      card.dataset.fontId = font.id;
      card.innerHTML = `
        <span class="font-card__preview">${Fonts.previewSVG(font.id, font.name)}</span>
        <span class="font-card__meta"><span class="font-card__name">${font.name}</span><span class="font-card__cat">${font.category}</span></span>
      `;
      card.addEventListener('click', () => {
        const block = getSelectedBlock();
        if (!block) return;
        block.fontId = font.id;
        Render.renderCanvas();
        this.renderStylePanel();
      });
      this.el.fontGrid.appendChild(card);
    });
  },

  /* ---------------- page & export panel ---------------- */

  populatePaperSelect() {
    this.el.paperSelect.innerHTML = PAPER_PRESETS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  },

  wirePagePanel() {
    this.el.paperSelect.value = AppState.page.presetId;
    this.el.paperSelect.addEventListener('change', () => {
      applyPagePreset(this.el.paperSelect.value);
      this.syncOrientationButtons();
      this.renderAll();
    });

    document.querySelectorAll('.btn--toggle[data-orientation]').forEach(btn => {
      btn.addEventListener('click', () => {
        setOrientation(btn.dataset.orientation);
        this.syncOrientationButtons();
        this.renderAll();
      });
    });

    this.el.pageWidthInput.addEventListener('change', () => {
      const w = this.fromDisplay(parseFloat(this.el.pageWidthInput.value) || AppState.page.widthMM);
      setCustomPageSize(w, AppState.page.heightMM);
      this.el.paperSelect.value = 'custom';
      this.syncOrientationButtons();
      this.renderAll();
    });
    this.el.pageHeightInput.addEventListener('change', () => {
      const h = this.fromDisplay(parseFloat(this.el.pageHeightInput.value) || AppState.page.heightMM);
      setCustomPageSize(AppState.page.widthMM, h);
      this.el.paperSelect.value = 'custom';
      this.syncOrientationButtons();
      this.renderAll();
    });
    this.el.marginInput.addEventListener('change', () => {
      AppState.page.marginMM = Math.max(0, this.fromDisplay(parseFloat(this.el.marginInput.value) || 0));
      this.renderAll();
    });

    this.el.showGridInput.addEventListener('change', () => { AppState.page.showGrid = this.el.showGridInput.checked; Render.renderCanvas(); });
    this.el.showMarginsInput.addEventListener('change', () => { AppState.page.showMargins = this.el.showMarginsInput.checked; Render.renderCanvas(); });
    this.el.showRegInput.addEventListener('change', () => { AppState.page.showRegistration = this.el.showRegInput.checked; Render.renderCanvas(); });

    this.el.showGridInput.checked = AppState.page.showGrid;
    this.el.showMarginsInput.checked = AppState.page.showMargins;
    this.el.showRegInput.checked = AppState.page.showRegistration;

    this.el.exportBtn.addEventListener('click', () => this.exportSVG());
    this.el.saveProjectBtn.addEventListener('click', () => this.saveProject());
    this.el.loadProjectBtn.addEventListener('click', () => this.el.loadProjectInput.click());
    this.el.loadProjectInput.addEventListener('change', (e) => this.loadProject(e));

    this.syncOrientationButtons();
  },

  syncOrientationButtons() {
    document.querySelectorAll('.btn--toggle[data-orientation]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.orientation === AppState.page.orientation);
    });
    this.el.pageWidthInput.value = this.toDisplay(AppState.page.widthMM).toFixed(2);
    this.el.pageHeightInput.value = this.toDisplay(AppState.page.heightMM).toFixed(2);
    this.el.marginInput.value = this.toDisplay(AppState.page.marginMM).toFixed(2);
  },

  updatePageLabel() {
    const preset = getPreset(AppState.page.presetId);
    const w = this.fmt(AppState.page.widthMM, AppState.units === 'mm' ? 1 : 2);
    const h = this.fmt(AppState.page.heightMM, AppState.units === 'mm' ? 1 : 2);
    this.el.pageLabel.textContent = `${preset.name} · ${w} × ${h}`;
    this.el.pageWidthInput.value = this.toDisplay(AppState.page.widthMM).toFixed(2);
    this.el.pageHeightInput.value = this.toDisplay(AppState.page.heightMM).toFixed(2);
    this.el.marginInput.value = this.toDisplay(AppState.page.marginMM).toFixed(2);
  },

  exportSVG() {
    const svgString = Render.buildExportSVG({ includeRegistration: this.el.exportRegInput.checked });
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    downloadBlob(blob, 'plotter-studio.svg');
  },

  saveProject() {
    const json = serializeProject();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    downloadBlob(blob, 'plotter-studio-project.json');
  },

  loadProject(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const obj = JSON.parse(evt.target.result);
        loadProjectFromObject(obj);
        this.el.paperSelect.value = AppState.page.presetId;
        document.querySelectorAll('.unit-toggle [data-unit]').forEach(b => b.classList.toggle('active', b.dataset.unit === AppState.units));
        this.syncOrientationButtons();
        this.renderAll();
      } catch (err) {
        alert('Could not load that project file: ' + err.message);
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  },

  /* ---------------- canvas interaction (select + drag) ---------------- */

  wireCanvasInteraction() {
    let dragId = null, offX = 0, offY = 0;

    this.el.canvas.addEventListener('mousedown', (e) => {
      const group = e.target.closest('.block-group.interactive');
      if (group) {
        const id = parseInt(group.dataset.id, 10);
        if (AppState.selectedBlockId !== id) { selectBlock(id); this.renderAll(); }
        dragId = id;
        const block = getBlock(id);
        const pos = Render.screenToMM(e);
        offX = pos.x - block.x;
        offY = pos.y - block.y;
      } else {
        if (AppState.selectedBlockId !== null) { selectBlock(null); this.renderAll(); }
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (dragId === null) return;
      const block = getBlock(dragId);
      if (!block) return;
      const pos = Render.screenToMM(e);
      block.x = Math.round((pos.x - offX) * 100) / 100;
      block.y = Math.round((pos.y - offY) * 100) / 100;
      Render.renderCanvas();
      this.updateBlockCardXY();
    });

    window.addEventListener('mouseup', () => { dragId = null; });

    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && AppState.selectedBlockId !== null && AppState.blocks.length > 1) {
        removeBlock(AppState.selectedBlockId);
        this.renderAll();
      }
    });
  },

  /* ---------------- zoom ---------------- */

  wireZoom() {
    this.el.zoomInBtn.addEventListener('click', () => { AppState.zoom = Math.min(4, AppState.zoom + 0.1); this.renderAll(); });
    this.el.zoomOutBtn.addEventListener('click', () => { AppState.zoom = Math.max(0.1, AppState.zoom - 0.1); this.renderAll(); });
    this.el.zoomFitBtn.addEventListener('click', () => {
      const vp = this.el.viewport.getBoundingClientRect();
      const availW = vp.width - 100, availH = vp.height - 100;
      const pageWpx = AppState.page.widthMM * PX_PER_MM;
      const pageHpx = AppState.page.heightMM * PX_PER_MM;
      AppState.zoom = Math.max(0.1, Math.min(availW / pageWpx, availH / pageHpx, 2));
      this.renderAll();
    });
  },

  updateZoomLabel() {
    this.el.zoomLabel.textContent = Math.round(AppState.zoom * 100) + '%';
  },

  /* ---------------- rulers ---------------- */

  updateRulers() {
    const unit = AppState.units;
    const stepMM = unit === 'mm' ? 10 : inToMm(1);
    const minorMM = unit === 'mm' ? 5 : inToMm(0.25);
    const pxPerMM = PX_PER_MM * AppState.zoom;

    this.buildRuler(this.el.rulerTop, AppState.page.widthMM, stepMM, minorMM, pxPerMM, unit, false);
    this.buildRuler(this.el.rulerLeft, AppState.page.heightMM, stepMM, minorMM, pxPerMM, unit, true);
  },

  buildRuler(container, lengthMM, stepMM, minorMM, pxPerMM, unit, vertical) {
    container.innerHTML = '';
    container.style[vertical ? 'height' : 'width'] = (lengthMM * pxPerMM) + 'px';
    let mm = 0, majorIndex = 0;
    while (mm <= lengthMM + 0.001) {
      const isMajor = Math.abs(mm % stepMM) < 0.001;
      const tick = document.createElement('div');
      tick.className = 'tick ' + (isMajor ? 'tick--major' : 'tick--minor');
      const pos = mm * pxPerMM;
      tick.style[vertical ? 'top' : 'left'] = pos + 'px';
      if (isMajor) {
        const label = document.createElement('span');
        label.className = 'tick__label';
        label.textContent = unit === 'mm' ? Math.round(mm) : majorIndex;
        tick.appendChild(label);
        majorIndex++;
      }
      container.appendChild(tick);
      mm += minorMM;
    }
  },
};

function escapeHTML(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
