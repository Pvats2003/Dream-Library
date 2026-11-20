/**
 * Seat layout builder: the owner describes each hall in plain terms
 * ("5 rows of 8 seats, a walkway after seat 4") and we generate labelled
 * seats. Tapping a seat in the preview removes it (pillars, doors).
 */

export type LabelStyle = "rows" | "prefix";

export type ZoneDraft = {
  key: string;
  name: string;
  rows: number;
  cols: number;
  /** Walkway after this many seats in a row; null for none. */
  aisleAfter: number | null;
  labelStyle: LabelStyle;
  /** For "rows": first row letter (A, then B, C…). For "prefix": e.g. "G" → G1, G2… */
  prefix: string;
  /** Cells left empty, as "row-col". */
  removed: string[];
  girlsOnly: boolean;
  ac: boolean;
  cabin: boolean;
};

export type GeneratedSeat = { label: string; x: number; y: number; row: number; col: number };

export const MAX_ROWS = 20;
export const MAX_COLS = 20;

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function cellKey(row: number, col: number) {
  return `${row}-${col}`;
}

/** Seats for one zone, in reading order. */
export function generateSeats(z: ZoneDraft): GeneratedSeat[] {
  const rows = clamp(z.rows, 1, MAX_ROWS);
  const cols = clamp(z.cols, 1, MAX_COLS);
  const removed = new Set(z.removed);
  const start = Math.max(0, LETTERS.indexOf((z.prefix || "A").toUpperCase()[0]));
  const out: GeneratedSeat[] = [];
  let n = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (removed.has(cellKey(r, c))) continue;
      n += 1;
      const label =
        z.labelStyle === "rows"
          ? `${LETTERS[(start + r) % 26]}${c + 1}`
          : `${(z.prefix || "S").toUpperCase().replace(/[^A-Z0-9-]/g, "")}${n}`;
      const x = z.aisleAfter !== null && z.aisleAfter > 0 && c >= z.aisleAfter ? c + 1 : c;
      out.push({ label, x, y: r, row: r, col: c });
    }
  }
  return out;
}

/** Labels used by more than one seat across all zones. */
export function duplicateLabels(zones: ZoneDraft[]): string[] {
  const seen = new Map<string, number>();
  for (const z of zones) for (const s of generateSeats(z)) seen.set(s.label, (seen.get(s.label) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([l]) => l);
}

export function totalSeats(zones: ZoneDraft[]) {
  return zones.reduce((n, z) => n + generateSeats(z).length, 0);
}

/** Payload for the save_layout database function. */
export function toLayoutPayload(zones: ZoneDraft[]) {
  return zones.map((z) => ({
    name: z.name.trim(),
    attributes: { ac: z.ac, girls_only: z.girlsOnly, cabin: z.cabin },
    seats: generateSeats(z).map((s) => ({ label: s.label, x: s.x, y: s.y })),
  }));
}

/**
 * Read an existing zone back into the builder's terms so it can be edited.
 * Works for anything the builder produced; hand-made layouts are
 * approximated (rows/columns from positions, labels by best guess).
 */
export function draftFromSeats(
  key: string,
  name: string,
  attributes: { ac?: boolean; girls_only?: boolean; cabin?: boolean },
  seats: { label: string; x: number; y: number }[],
): ZoneDraft {
  const xs = [...new Set(seats.map((s) => s.x))].sort((a, b) => a - b);
  const maxX = Math.max(0, ...xs);
  // An empty column inside the range is the walkway.
  let aisleAfter: number | null = null;
  for (let x = 1; x < maxX; x++) {
    if (!xs.includes(x)) {
      aisleAfter = x;
      break;
    }
  }
  const cols = aisleAfter === null ? maxX + 1 : maxX;
  const rows = Math.max(0, ...seats.map((s) => s.y)) + 1;
  const toCol = (x: number) => (aisleAfter !== null && x > aisleAfter ? x - 1 : x);
  const present = new Set(seats.map((s) => cellKey(s.y, toCol(s.x))));
  const removed: string[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!present.has(cellKey(r, c))) removed.push(cellKey(r, c));

  const rowStyle = seats.length > 0 && seats.every((s) => /^[A-Z]\d+$/.test(s.label) && Number(s.label.slice(1)) === toCol(s.x) + 1);
  const first = [...seats].sort((a, b) => a.y - b.y || a.x - b.x)[0];
  const prefix = rowStyle
    ? LETTERS[(LETTERS.indexOf(first.label[0]) - first.y + 26) % 26]
    : (first?.label.match(/^[A-Za-z-]*/)?.[0] ?? "S") || "S";

  return {
    key,
    name,
    rows: Math.max(1, rows),
    cols: Math.max(1, cols),
    aisleAfter,
    labelStyle: rowStyle ? "rows" : "prefix",
    prefix,
    removed,
    girlsOnly: Boolean(attributes.girls_only),
    ac: Boolean(attributes.ac),
    cabin: Boolean(attributes.cabin),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n || lo)));
}
