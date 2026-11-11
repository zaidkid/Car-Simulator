// Shared device-quality flags.
//
// Testing without a phone: add ?q=low or ?q=high to the URL,
// e.g. http://localhost:5173/?q=low

const hasWindow = typeof window !== "undefined";
const forced = hasWindow
  ? new URLSearchParams(window.location.search).get("q")
  : null;

export const PHONE =
  hasWindow && window.matchMedia("(pointer: coarse)").matches;

// iOS Safari does not report deviceMemory, so a missing value means "unknown",
// not "low". Android Chrome reports 0.25 / 0.5 / 1 / 2 / 4 / 8.
const mem =
  (typeof navigator !== "undefined" && navigator.deviceMemory) || 8;
const cores =
  (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 8;

export const LOW_POWER =
  forced === "low"
    ? true
    : forced === "high"
      ? false
      : PHONE && (mem <= 2 || cores <= 4);