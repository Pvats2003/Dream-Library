/** A calm "all done" moment: a check that draws itself once. No confetti. */
export function AllClear({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[20px] border border-success/25 bg-success-soft p-5" role="status">
      <svg viewBox="0 0 52 52" className="size-14 shrink-0" aria-hidden>
        <circle cx="26" cy="26" r="23" fill="none" strokeWidth="3" className="all-clear-ring stroke-success-solid" />
        <path d="M15 27 l7.5 7.5 L37 19" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="all-clear-tick stroke-success-solid" />
      </svg>
      <div>
        <p className="text-lg font-semibold text-success">{title}</p>
        <p className="text-[15px] text-text-2">{body}</p>
      </div>
    </div>
  );
}
