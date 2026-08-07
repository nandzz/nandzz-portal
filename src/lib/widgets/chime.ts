// A short, pleasant two-tone notification chime synthesized on the fly with
// the Web Audio API — no audio file, no dependency. Meant to play only while
// the owner is actively looking at the tab; a backgrounded tab relies on the
// separate notification-bell entry instead, so the visibility gate lives
// right here rather than at every call site.

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new Ctor();
  }
  return sharedContext;
}

// Plays a single sine tone with a short attack/release envelope so it starts
// and ends smoothly instead of clicking/popping.
function playTone(ctx: AudioContext, frequencyHz: number, startTime: number, durationSec: number, peakGain: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequencyHz;
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const attack = 0.015;
  const release = 0.05;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
  gain.gain.setValueAtTime(peakGain, startTime + Math.max(attack, durationSec - release));
  gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

  oscillator.start(startTime);
  oscillator.stop(startTime + durationSec);
}

// Two quick ascending tones (A5 -> E6, a major sixth) — reads as a friendly
// "ding-ding" rather than an alarm.
export function playBookingChime(): void {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  playTone(ctx, 880, now, 0.16, 0.18); // A5
  playTone(ctx, 1318.51, now + 0.13, 0.22, 0.15); // E6
}
