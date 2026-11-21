"use client";

import { IndianRupee, MessageCircle } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const THRESHOLD = 90;
const LONG_PRESS_MS = 550;

/**
 * Shortcuts only: drag right = got paid, drag left = remind, long-press =
 * more options. Every one of these also exists as a visible button.
 */
export function SwipeRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  rightLabel,
  leftLabel,
  disabled,
}: {
  children: ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onLongPress: () => void;
  rightLabel: string;
  leftLabel: string;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const horizontal = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fired = useRef(false);

  function end(commit: boolean) {
    clearTimeout(timer.current);
    if (commit && !fired.current) {
      if (dx > THRESHOLD) {
        navigator.vibrate?.(15);
        onSwipeRight();
      } else if (dx < -THRESHOLD) {
        navigator.vibrate?.(15);
        onSwipeLeft();
      }
    }
    start.current = null;
    horizontal.current = false;
    setDx(0);
  }

  return (
    <div className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 flex items-center justify-between">
        <span className={cn("flex h-full items-center gap-2 bg-success-solid px-5 font-semibold text-on-solid transition-opacity", dx > 20 ? "opacity-100" : "opacity-0")}>
          <IndianRupee className="size-5" />
          {rightLabel}
        </span>
        <span className={cn("ml-auto flex h-full items-center gap-2 bg-[var(--upcoming)] px-5 font-semibold text-on-solid transition-opacity", dx < -20 ? "opacity-100" : "opacity-0")}>
          {leftLabel}
          <MessageCircle className="size-5" />
        </span>
      </div>
      <div
        className={cn("relative bg-surface", dx === 0 && "transition-transform duration-200 ease-out")}
        style={{ transform: `translateX(${dx}px)`, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (disabled || (e.target as HTMLElement).closest("button, a, input")) return;
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          fired.current = false;
          timer.current = setTimeout(() => {
            fired.current = true;
            navigator.vibrate?.(30);
            onLongPress();
            end(false);
          }, LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          if (!start.current || start.current.id !== e.pointerId) return;
          const x = e.clientX - start.current.x;
          const y = e.clientY - start.current.y;
          if (Math.abs(x) > 8 || Math.abs(y) > 8) clearTimeout(timer.current);
          if (!horizontal.current) {
            if (Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.5) {
              horizontal.current = true;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } else return;
          }
          setDx(Math.max(-140, Math.min(140, x)));
        }}
        onPointerUp={() => end(true)}
        onPointerCancel={() => end(false)}
      >
        {children}
      </div>
    </div>
  );
}
