const hasWindow = typeof window !== "undefined";

const forced = hasWindow
  ? new URLSearchParams(window.location.search).get("q")
  : null;

// Detect touch-based devices (phones and tablets).
export const PHONE =
  hasWindow &&
  window.matchMedia("(pointer: coarse)").matches;

// Backward-compatible alias for components importing IS_MOBILE.
export const IS_MOBILE = PHONE;

// Device memory (Android Chrome reports this; iOS may not).
const mem =
  (typeof navigator !== "undefined" && navigator.deviceMemory) || 8;

// Available CPU cores.
const cores =
  (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 8;

// Determine whether the device should use low-quality graphics.
export const LOW_POWER =
  forced === "low"
    ? true
    : forced === "high"
      ? false
      : PHONE && (mem <= 2 || cores <= 4);

// Shared quality preset.
export const QUALITY = LOW_POWER ? "low" : "high";
