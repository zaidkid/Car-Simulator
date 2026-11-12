
// Shared device and graphics quality detection.

const hasWindow = typeof window !== "undefined";

const forced = hasWindow
  ? new URLSearchParams(window.location.search).get("q")
  : null;

// Touchscreen device detection.
export const PHONE =
  hasWindow &&
  window.matchMedia("(pointer: coarse)").matches;

// Backward compatibility.
export const IS_MOBILE = PHONE;

// Hardware information.
const memory =
  typeof navigator !== "undefined"
    ? navigator.deviceMemory ?? 8
    : 8;

const cores =
  typeof navigator !== "undefined"
    ? navigator.hardwareConcurrency ?? 8
    : 8;

// Detect weaker hardware.
export const LOW_POWER =
  forced === "low"
    ? true
    : forced === "high"
      ? false
      : PHONE && (memory <= 3 || cores <= 4);

// Quality presets.
export const QUALITY = LOW_POWER
  ? "low"
  : PHONE
    ? "medium"
    : "high";
