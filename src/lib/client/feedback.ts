/**
 * Optional "payment received" feedback: a soft buzz and a quiet two-note
 * tick. Off unless the person turns it on in More → settings.
 */
const KEY = "pay-feedback";

export function feedbackOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setFeedback(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private mode: the setting just won't be remembered.
  }
}

let ctx: AudioContext | undefined;

export function paymentFeedback(force = false) {
  if (!force && !feedbackOn()) return;
  navigator.vibrate?.([18, 40, 18]);
  try {
    ctx ??= new AudioContext();
    const now = ctx.currentTime;
    for (const [i, freq] of [880, 1320].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = now + i * 0.09;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.08, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.18);
    }
  } catch {
    // No sound on this device: the buzz is enough.
  }
}
