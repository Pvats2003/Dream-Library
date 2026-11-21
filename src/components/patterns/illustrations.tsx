/**
 * Small hand-drawn line pictures for empty screens. Ink follows the text
 * colour, with one touch of lamp-amber. Each is well under 5 KB.
 */
const ink = { fill: "none", stroke: "currentColor", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const amber = "var(--accent)";

/** A sleepy owl on a branch: nothing to do, all quiet. */
export function SleepyOwl({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <ellipse cx="80" cy="112" rx="46" ry="4" fill="currentColor" opacity="0.08" />
      <path d="M22 98c30-3 82-4 118 1" {...ink} />
      <path d="M118 99c6-5 12-7 18-6M42 98c-5-5-9-6-14-5" {...ink} />
      <path d="M56 96c-6-18-6-44 4-58 4-6 10-9 20-9s16 3 20 9c10 14 10 40 4 58" {...ink} />
      <path d="M60 39l-6-13 15 7M100 39l6-13-15 7" {...ink} />
      <path d="M64 52c4 3 9 3 13 0M83 52c4 3 9 3 13 0" {...ink} />
      <path d="M77 60l3 5 3-5z" fill={amber} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M66 74c4 4 6 4 8 0 2 4 5 4 7 0 2 4 5 4 7 0 2 4 4 4 7 0M70 84c3 3 5 3 7 0 2 3 4 3 6 0 2 3 4 3 7 0" {...ink} strokeWidth="1.8" opacity="0.6" />
      <path d="M68 96v4M74 96v4M86 96v4M92 96v4" {...ink} />
      <path d="M112 30h8l-8 9h8M124 16h6l-6 7h6" {...ink} strokeWidth="2" opacity="0.55" />
    </svg>
  );
}

/** A neat stack of books with a lamp glow: waiting for the first student. */
export function BookStack({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <circle cx="112" cy="34" r="20" fill={amber} opacity="0.22" />
      <ellipse cx="80" cy="112" rx="50" ry="4" fill="currentColor" opacity="0.08" />
      <path d="M36 106h88c2 0 3-2 3-4v-10c0-2-1-3-3-3H36c-2 0-3 1-3 3v10c0 2 1 4 3 4z" {...ink} />
      <path d="M44 89v17M116 92h-22" {...ink} />
      <path d="M44 89l2-15c0-2 2-3 4-3h74c2 0 3 2 3 4l-2 14" {...ink} />
      <path d="M56 71v18M96 80h20" {...ink} />
      <path d="M52 71l4-14c1-2 2-3 4-3h56c2 0 3 2 2 4l-4 13" {...ink} />
      <path d="M100 54v17M66 62h18" {...ink} />
      <path d="M104 40l9-22c1-2 3-2 4 0l2 6" {...ink} />
      <path d="M100 40h26" {...ink} />
      <path d="M113 40v14" {...ink} strokeDasharray="2 5" opacity="0.6" />
    </svg>
  );
}

/** An empty desk and chair: no seats set up yet. */
export function EmptyDesk({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 120" className={className} aria-hidden>
      <ellipse cx="80" cy="112" rx="56" ry="4" fill="currentColor" opacity="0.08" />
      <path d="M26 60c36-2 72-2 108 0" {...ink} />
      <path d="M32 60v48M128 60v48M32 76h96" {...ink} />
      <path d="M104 60l6-22M110 38c-6 0-12 1-16 4" {...ink} />
      <circle cx="94" cy="44" r="7" fill={amber} opacity="0.35" />
      <path d="M48 52c6-4 16-4 22 0" {...ink} opacity="0.7" />
      <path d="M58 108l2-24h40l2 24M64 84l-3-26c0-3 2-5 5-5h28c3 0 5 2 5 5l-3 26" {...ink} opacity="0.55" />
    </svg>
  );
}

export const ART = { owl: SleepyOwl, books: BookStack, desk: EmptyDesk } as const;
