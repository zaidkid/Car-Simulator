// Shared device checks (import from here instead of repeating the same matchMedia code).

export const PHONE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

// Only truly weak phones: low memory or very few CPU cores.
// Missing values (iPhones don't report memory) count as "fine", not "weak".
export const LOW_POWER =
  PHONE &&
  typeof navigator !== "undefined" &&
  ((navigator.deviceMemory ?? 8) <= 3 || (navigator.hardwareConcurrency ?? 8) <= 4);