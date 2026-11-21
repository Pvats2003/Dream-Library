"use client";

import { Delete } from "lucide-react";
import { useSyncExternalStore } from "react";

const query = "(pointer: coarse) and (max-width: 1023px)";
const subscribe = (cb: () => void) => {
  const m = matchMedia(query);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/** True on phones: there we show our own big keypad instead of the phone's keyboard. */
export function useBigKeypad() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false,
  );
}

/**
 * Big number keys (56px) for phone numbers and rupees, so a thumb never
 * misses. Desktop uses the real keyboard instead.
 */
export function Keypad({
  onKey,
  extra,
  deleteLabel,
}: {
  onKey: (k: string) => void;
  extra?: string;
  deleteLabel: string;
}) {
  const keys = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    extra ?? "",
    "0",
    "del",
  ];
  return (
    <div
      className="mt-4 grid grid-cols-3 gap-2 select-none"
      role="group"
      aria-label={deleteLabel}
    >
      {keys.map((k, i) =>
        k === "" ? (
          <span key={i} />
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => {
              navigator.vibrate?.(8);
              onKey(k);
            }}
            aria-label={k === "del" ? deleteLabel : undefined}
            className="grid h-14 place-items-center rounded-[14px] bg-surface-2 text-2xl font-semibold tabular transition-[transform,background-color] duration-100 active:scale-95 active:bg-surface-press"
          >
            {k === "del" ? <Delete className="size-6" aria-hidden /> : k}
          </button>
        ),
      )}
    </div>
  );
}
