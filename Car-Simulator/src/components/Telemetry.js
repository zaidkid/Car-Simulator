// Shared, non-React state.
// Car.jsx and Race.jsx WRITE to these objects every frame.
// FollowCamera, Effects and CockpitDash READ them (no React re-renders).

export const telemetry = {
  speed: 0, // m/s
  kmh: 0,
  gear: 0, // -1 = R, 0 = N, 1..8
  rpm: 4200,
  idleRpm: 4200,
  maxRpm: 12500,
  throttle: 0, // 0..1
  brake: 0, // 0..1
  steer: 0, // -1..1 (positive = left)
  latG: 0, // positive = turning left
  longG: 0, // positive = accelerating
  battery: 100, // ERS battery %
  ers: false, // ERS overtake deploy active
  drs: false, // DRS open
  surface: "track", // track | kerb | runoff | gravel
  kerbShake: 0, // 0..1, used by the camera
  camera: "cockpit", // cockpit | tcam | chase
};

// Start lights sequence (written by Race.jsx, read by Car.jsx)
export const grid = {
  active: false, // true while the countdown is running
  lights: 0, // 0..5 red lights on
  go: false, // true once lights are out
};

// Live race info (written by Race.jsx)
export const raceInfo = {
  lap: 1,
  laps: 3,
  position: 1,
  total: 6,
  sector: 1,
  lapTime: 0,
  lastLap: null,
  bestLap: null,
  sectorTimes: [null, null, null],
  elapsed: 0,
  finished: false,
};