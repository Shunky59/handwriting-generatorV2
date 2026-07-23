/* Central app state. Every physical measurement (position, size, spacing,
   margins, page dimensions) is stored in millimeters regardless of which
   unit the UI currently displays — mm is the single source of truth so the
   exported SVG is always physically accurate for GCode conversion. */

const AppState = {
  units: 'mm', // 'mm' | 'in' — display only
  page: {
    presetId: 'letter',
    widthMM: 215.9,
    heightMM: 279.4,
    orientation: 'portrait',
    marginMM: 12.7,
    showGrid: true,
    showMargins: true,
    showRegistration: true,
  },
  zoom: 1,
  blocks: [],
  selectedBlockId: null,
  blockIdCounter: 1,
  penPalette: [
    { label: 'Pen 1', color: '#1A2233' },
    { label: 'Pen 2', color: '#2F5D8A' },
    { label: 'Pen 3', color: '#B2452C' },
  ],
};

function createDefaultBlock(overrides = {}) {
  const id = AppState.blockIdCounter++;
  return Object.assign({
    id,
    text: 'Dear friend,\nThank you so much.',
    x: 20,
    y: 30,
    align: 'left',
    fontId: 'casual-hand',
    sizeMM: 8,
    letterSpacingMM: 0.6,
    wordSpacingMM: 3.2,
    lineHeightMM: 11,
    rotation: 0,
    slant: 0,
    italics: false,
    underline: false,
    strikethrough: false,
    wobbleMM: 0,
    jitter: 0,
    penColor: '#1A2233',
    penLabel: 'Pen 1',
    strokeWidthMM: 0.3,
    _widthMM: 0,
    _heightMM: 0,
  }, overrides);
}

function addBlock(overrides = {}) {
  const block = createDefaultBlock(overrides);
  AppState.blocks.push(block);
  AppState.selectedBlockId = block.id;
  return block;
}

function removeBlock(id) {
  AppState.blocks = AppState.blocks.filter(b => b.id !== id);
  if (AppState.selectedBlockId === id) {
    AppState.selectedBlockId = AppState.blocks.length ? AppState.blocks[0].id : null;
  }
}

function getBlock(id) {
  return AppState.blocks.find(b => b.id === id) || null;
}

function getSelectedBlock() {
  return getBlock(AppState.selectedBlockId);
}

function selectBlock(id) {
  AppState.selectedBlockId = id;
}

function applyPagePreset(presetId) {
  const preset = getPreset(presetId);
  AppState.page.presetId = presetId;
  let w = preset.widthMM, h = preset.heightMM;
  if (AppState.page.orientation === 'landscape' && w < h) { [w, h] = [h, w]; }
  if (AppState.page.orientation === 'portrait' && w > h) { [w, h] = [h, w]; }
  AppState.page.widthMM = w;
  AppState.page.heightMM = h;
}

function setOrientation(orientation) {
  AppState.page.orientation = orientation;
  const { widthMM, heightMM } = AppState.page;
  if (orientation === 'landscape' && widthMM < heightMM) {
    AppState.page.widthMM = heightMM;
    AppState.page.heightMM = widthMM;
  } else if (orientation === 'portrait' && widthMM > heightMM) {
    AppState.page.widthMM = heightMM;
    AppState.page.heightMM = widthMM;
  }
}

function setCustomPageSize(widthMM, heightMM) {
  AppState.page.presetId = 'custom';
  AppState.page.widthMM = widthMM;
  AppState.page.heightMM = heightMM;
  AppState.page.orientation = widthMM > heightMM ? 'landscape' : 'portrait';
}

function serializeProject() {
  return JSON.stringify({
    kind: 'plotter-studio-project',
    version: 1,
    units: AppState.units,
    page: AppState.page,
    blocks: AppState.blocks,
  }, null, 2);
}

function loadProjectFromObject(obj) {
  if (!obj || obj.kind !== 'plotter-studio-project') {
    throw new Error('This file is not a Plotter Studio project.');
  }
  AppState.units = obj.units || 'mm';
  AppState.page = Object.assign({}, AppState.page, obj.page);
  AppState.blocks = (obj.blocks || []).map(b => Object.assign(createDefaultBlock(), b));
  AppState.blockIdCounter = 1 + AppState.blocks.reduce((m, b) => Math.max(m, b.id), 0);
  AppState.selectedBlockId = AppState.blocks.length ? AppState.blocks[0].id : null;
}
