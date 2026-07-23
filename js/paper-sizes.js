/* Paper & card presets. All dimensions stored in millimeters — the single
   source of truth — since the exported SVG is physically scaled in mm for
   downstream GCode conversion. Inches are derived for display only. */

const MM_PER_IN = 25.4;
const PX_PER_MM = 96 / MM_PER_IN; // CSS px at 96dpi, standard browser mm

function mmToIn(mm) { return mm / MM_PER_IN; }
function inToMm(inches) { return inches * MM_PER_IN; }

function formatLength(mm, unit, opts = {}) {
  const decimals = opts.decimals ?? (unit === 'mm' ? 1 : 2);
  const value = unit === 'mm' ? mm : mmToIn(mm);
  return `${value.toFixed(decimals)}${unit}`;
}

const PAPER_PRESETS = [
  { id: 'letter',   name: 'US Letter',        widthMM: 215.9, heightMM: 279.4 },
  { id: 'legal',    name: 'US Legal',         widthMM: 215.9, heightMM: 355.6 },
  { id: 'a4',       name: 'A4',               widthMM: 210,   heightMM: 297 },
  { id: 'a5',       name: 'A5',               widthMM: 148,   heightMM: 210 },
  { id: 'a6',       name: 'A6',               widthMM: 105,   heightMM: 148 },
  { id: 'index-3x5',name: 'Index Card 3×5"',  widthMM: 76.2,  heightMM: 127 },
  { id: 'index-4x6',name: 'Index Card 4×6"',  widthMM: 101.6, heightMM: 152.4 },
  { id: 'note-5x7', name: 'Note Card 5×7"',   widthMM: 127,   heightMM: 177.8 },
  { id: 'thankyou', name: 'Thank-You Card 4.25×5.5"', widthMM: 108, heightMM: 139.7 },
  { id: 'square-6', name: 'Square 6×6"',      widthMM: 152.4, heightMM: 152.4 },
  { id: 'custom',   name: 'Custom',           widthMM: 150,   heightMM: 150 },
];

function getPreset(id) {
  return PAPER_PRESETS.find(p => p.id === id) || PAPER_PRESETS[0];
}
