import { useLayoutEffect, useMemo, useRef } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { game, DRIVERS } from "./gameStore";
import { grid, raceInfo } from "./Telemetry";
import { curve } from "./Trackcurve";
import { prepareCarModel } from "./CarModel";
import { mapCars } from "./Racemap";

// Begin downloading and parsing the player/AI car model as soon as this
// module is imported, rather than waiting for the Race component to mount.
useGLTF.preload("/models/Red_bull_car.glb");

// ==========================================
// CONFIGURATION
// ==========================================

const SAMPLES = 1400;
export const TRACK_WIDTH = 10; // half width of the asphalt
const KERB_WIDTH = 2;
const RUNOFF_END = 19;
const GRAVEL_END = 26;
export const WALL_OFFSET = GRAVEL_END;
const LAPS = 1;
const GRID_GAP = 7;

// F1-style rules
const LIMIT = TRACK_WIDTH + 1; // car centre this far out = all four wheels over the white line
const LIMITS_PER_PENALTY = 3; // every 3rd track-limit offence = time penalty
const PENALTY = 5; // seconds
const DRS_RULES = true; // false = DRS anywhere
const DRS_FROM_LAP = 2;
const DRS_GAP = 1.0; // seconds to the car ahead

// ---- AI field: every AI gets a different pace each race ----
// pace is 0 (slowest) .. 1 (fastest). Paces are shuffled across the five AI
// cars at the start of every race, so the grid order says nothing about who is quick.
const AI_SPEED_MIN = 46; // m/s (~166 km/h): slower AI
const AI_SPEED_MAX = 60; // m/s (~216 km/h): fastest AI
const AI_GRIP_MIN = 0.82; // slower drivers lose more speed in corners
const AI_GRIP_MAX = 0.94; // strongest AI remains below player performance
const PACE_JITTER = 0.28; // varied but controlled pace differences

// ---- AI racecraft ----
const PASS_LOOKAHEAD = 24; // m: how far ahead an AI looks for a slower car
const PASS_CLEARANCE = 3.6; // m: sideways gap used when going around a car
const LAT_LIMIT = TRACK_WIDTH - 1.6; // AI never goes wider than this
const RUBBER_BAND = 0.025; // 0 = off. +/- this fraction of speed to keep the race close to the player
const RUBBER_RANGE = 250; // m of gap to the player at which rubber-banding is at full strength

const AI_COLORS = ["#3671ff", "#e10600", "#ff8700", "#e10600", "#00d2be"];
const UP = new THREE.Vector3(0, 1, 0);

// ==========================================
// TRACK DATA
// ==========================================

const TRACK_LENGTH = curve.getLength();
const TOTAL = LAPS * TRACK_LENGTH;
const DS = TRACK_LENGTH / SAMPLES;
const wrap = (d) => ((d % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;

const PLAYER_START_DISTANCE = -(AI_COLORS.length + 1) * GRID_GAP;
const startT = wrap(PLAYER_START_DISTANCE) / TRACK_LENGTH;
const startPoint = curve.getPointAt(startT);
const startTangent = curve.getTangentAt(startT);

export const START = {
  pos: [startPoint.x, 0.42, startPoint.z],
  yaw: Math.atan2(startTangent.x, startTangent.z),
};

// Written every frame by the race loop, read by Car.jsx
export const track = {
  off: false,
  surface: "track", // track | kerb | runoff | gravel
  offset: 0,
  index: 0,
  resetToken: 0,
  drsAllowed: false,
};

const linePoint = curve.getPointAt(0);
const lineYaw = Math.atan2(curve.getTangentAt(0).x, curve.getTangentAt(0).z);

const points = [];
const normals = [];
const tangents = [];

for (let i = 0; i < SAMPLES; i++) {
  const tangent = curve.getTangentAt(i / SAMPLES);
  points.push(curve.getPointAt(i / SAMPLES));
  tangents.push(tangent.clone());
  normals.push(new THREE.Vector3(-tangent.z, 0, tangent.x).normalize());
}

export const trackPoints = points;
export const trackNormals = normals;

// Positive curvature = the corner bends toward the +normal side
const rawCurvature = points.map((_, i) => {
  const a = tangents[(i - 1 + SAMPLES) % SAMPLES];
  const b = tangents[(i + 1) % SAMPLES];
  return ((b.x - a.x) * normals[i].x + (b.z - a.z) * normals[i].z) / (2 * DS);
});

const curvature = rawCurvature.map((_, i) => {
  let sum = 0;
  for (let o = -8; o <= 8; o++) sum += rawCurvature[(i + o + SAMPLES) % SAMPLES];
  return sum / 17;
});

// Fastest speed (m/s) a car can carry through each part of the track
const AI_LATERAL_ACCEL = 40;
const cornerSpeed = curvature.map((k) =>
  THREE.MathUtils.clamp(Math.sqrt(AI_LATERAL_ACCEL / Math.max(Math.abs(k), 1e-4)), 28, 120)
);

const LOOK = Math.round(350 / DS);

// Speed an AI car may carry now so it can still brake for the next ~350 m
function brakingTarget(distance, topSpeed, gripScale, brake) {
  const start = Math.floor(wrap(distance) / DS);
  let target = topSpeed;

  for (let step = 0; step < LOOK; step += 3) {
    const corner = Math.min(topSpeed, cornerSpeed[(start + step) % SAMPLES] * gripScale);
    const allowed = Math.sqrt(corner * corner + 2 * brake * step * DS);
    if (allowed < target) target = allowed;
  }

  return target;
}

// DRS zones: straights longer than 250 m
const drsZone = new Array(SAMPLES).fill(false);
{
  const begin = Math.max(0, curvature.findIndex((k) => Math.abs(k) > 0.002));
  let s = -1;

  for (let j = 0; j <= SAMPLES; j++) {
    const straight = j < SAMPLES && Math.abs(curvature[(begin + j) % SAMPLES]) < 0.0012;

    if (straight && s < 0) s = j;

    if (!straight && s >= 0) {
      if ((j - s) * DS >= 250) {
        for (let m = s + 8; m < j - 10; m++) drsZone[(begin + m) % SAMPLES] = true;
      }
      s = -1;
    }
  }
}

// ==========================================
// TRACK GEOMETRY
// ==========================================

function makeStrip(inner, outer, y, colorAt) {
  const positions = [];
  const colors = [];

  for (let i = 0; i < SAMPLES; i++) {
    const next = (i + 1) % SAMPLES;
    const color = colorAt(i);

    for (const [index, offset] of [
      [i, inner], [i, outer], [next, outer],
      [i, inner], [next, outer], [next, inner],
    ]) {
      positions.push(
        points[index].x + normals[index].x * offset,
        y,
        points[index].z + normals[index].z * offset
      );
      colors.push(color.r, color.g, color.b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  return geometry;
}

const both = (a, b, y, colorAt) => [makeStrip(a, b, y, colorAt), makeStrip(-b, -a, y, colorAt)];

const white = new THREE.Color("#f4f4f4");
const red = new THREE.Color("#d71920");
const concrete = new THREE.Color("#3a3d44");
const runoffColor = new THREE.Color("#55585e");
const gravelColor = new THREE.Color("#b9a67f");

// Asphalt in lateral bands: the middle is darker (rubbered-in racing line)
const BANDS = [
  [-TRACK_WIDTH, -6, "#303338"],
  [-6, -2, "#2a2c31"],
  [-2, 2, "#232529"],
  [2, 6, "#2a2c31"],
  [6, TRACK_WIDTH, "#303338"],
].map(([a, b, hex]) => {
  const dark = new THREE.Color(hex);
  const light = dark.clone().offsetHSL(0, 0, 0.012);
  return [a, b, dark, light];
});

// Kerbs only in corners; flat concrete on straights
const kerbColor = (i) =>
  Math.abs(curvature[i]) > 0.0028 ? (i % 2 ? red : white) : concrete;

// Drawn bottom to top (later layers get a stronger polygon offset)
const trackMeshes = [
  ...both(RUNOFF_END, GRAVEL_END, 0.045, () => gravelColor),
  ...both(TRACK_WIDTH + KERB_WIDTH, RUNOFF_END, 0.05, () => runoffColor),
  ...BANDS.map(([a, b, dark, light]) => makeStrip(a, b, 0.055, (i) => (i % 60 < 30 ? dark : light))),
  ...both(TRACK_WIDTH, TRACK_WIDTH + KERB_WIDTH, 0.06, kerbColor),
  ...both(TRACK_WIDTH - 0.55, TRACK_WIDTH - 0.3, 0.062, () => white), // track-limit lines
];

// ==========================================
// BARRIERS, TYRE WALLS, DRS BOARDS (instanced)
// ==========================================

const BARRIER_COLORS = ["#d71920", "#f4f4f4", "#1b2a6b", "#101114"];
const BARRIER_STEP = 3;
const BARRIER_LENGTH = BARRIER_STEP * DS * 1.03;

const at = (i, offset, y) =>
  new THREE.Vector3(
    points[i].x + normals[i].x * offset,
    y,
    points[i].z + normals[i].z * offset
  );

const barrierItems = [];
const tyreItems = [];
const drsItems = [];

for (let i = 0; i < SAMPLES; i += BARRIER_STEP) {
  const yaw = Math.atan2(tangents[i].x, tangents[i].z);
  const color = BARRIER_COLORS[Math.floor(i / BARRIER_STEP / 2) % BARRIER_COLORS.length];

  for (const side of [1, -1]) {
    barrierItems.push({ position: at(i, side * WALL_OFFSET, 0.6), yaw, color });
  }
}

// Tyre stacks on the outside of the tighter corners
for (let i = 0; i < SAMPLES; i++) {
  if (Math.abs(curvature[i]) < 0.0055) continue;

  const outside = -Math.sign(curvature[i]);

  for (let layer = 0; layer < 2; layer++) {
    tyreItems.push({
      position: at(i, outside * (WALL_OFFSET - 1.1 - (i % 2) * 0.9), 0.25 + layer * 0.5),
      yaw: 0,
      color: (i + layer) % 7 === 0 ? "#d71920" : "#17181b",
    });
  }
}

// Green DRS boards at the start of each zone
drsZone.forEach((zone, i) => {
  if (!zone || drsZone[(i - 1 + SAMPLES) % SAMPLES]) return;

  for (const side of [1, -1]) {
    drsItems.push({
      position: at(i, side * (TRACK_WIDTH + KERB_WIDTH + 1.5), 1.5),
      yaw: Math.atan2(tangents[i].x, tangents[i].z),
      color: "#00c853",
    });
  }
});

function InstancedItems({ items, children }) {
  const ref = useRef();

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const color = new THREE.Color();

    items.forEach((item, index) => {
      quaternion.setFromAxisAngle(UP, item.yaw);
      matrix.compose(item.position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.set(item.color));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items]);

  if (!items.length) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      receiveShadow
      frustumCulled={false}
    >
      {children}
      <meshStandardMaterial roughness={0.65} metalness={0.05} />
    </instancedMesh>
  );
}

// ==========================================
// START LINE, GRID BOXES AND START LIGHTS
// ==========================================

function makeCheckerTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 32;

  const ctx = canvas.getContext("2d");
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 2; y++) {
      ctx.fillStyle = (x + y) % 2 ? "#111111" : "#f4f4f4";
      ctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

const checkerTexture = makeCheckerTexture();

const laneXZ = (distance, lane) => {
  const t = wrap(distance) / TRACK_LENGTH;
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  return { x: p.x - tan.z * lane, z: p.z + tan.x * lane, yaw: Math.atan2(tan.x, tan.z) };
};

const gridSlots = [
  ...AI_COLORS.map((_, i) => laneXZ(-(i + 1) * GRID_GAP, i % 2 === 0 ? -3 : 3)),
  laneXZ(PLAYER_START_DISTANCE, 0),
];

function GridBoxes() {
  return gridSlots.map((slot, index) => (
    <group key={index} position={[slot.x, 0.075, slot.z]} rotation={[0, slot.yaw, 0]}>
      {[
        [0, 3.4, 2.6, 0.14],
        [-1.3, 0.4, 0.1, 6],
        [1.3, 0.4, 0.1, 6],
      ].map(([x, z, w, d], k) => (
        <mesh key={k} position={[x, 0, z]}>
          <boxGeometry args={[w, 0.01, d]} />
          <meshBasicMaterial color="#f2f2f2" />
        </mesh>
      ))}
    </group>
  ));
}

function StartLine({ lightMats }) {
  return (
    <group position={[linePoint.x, 0, linePoint.z]} rotation={[0, lineYaw, 0]}>
      <mesh position={[0, 0.068, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TRACK_WIDTH * 2, 2]} />
        <meshBasicMaterial
          map={checkerTexture}
          polygonOffset
          polygonOffsetFactor={-12}
          polygonOffsetUnits={-12}
        />
      </mesh>

      {[-14, 14].map((x) => (
        <mesh key={x} position={[x, 4.2, 0]} castShadow>
          <boxGeometry args={[0.9, 8.4, 0.9]} />
          <meshStandardMaterial color="#1a1c22" roughness={0.5} />
        </mesh>
      ))}

      <mesh position={[0, 8.4, 0]} castShadow>
        <boxGeometry args={[29, 1.4, 1.4]} />
        <meshStandardMaterial color="#1a1c22" roughness={0.5} />
      </mesh>

      <mesh position={[0, 7.6, -0.3]}>
        <boxGeometry args={[11.5, 2.4, 0.7]} />
        <meshStandardMaterial color="#0c0d10" roughness={0.6} />
      </mesh>

      {/* Five columns of two lights, facing the grid (behind the line) */}
      {[0, 1, 2, 3, 4].flatMap((column) =>
        [0, 1].map((row) => (
          <mesh key={`${column}-${row}`} position={[(column - 2) * 2.1, 8.05 - row * 0.9, -0.72]}>
            <sphereGeometry args={[0.34, 16, 16]} />
            <meshBasicMaterial
              ref={(m) => {
                if (m) lightMats.current[column * 2 + row] = m;
              }}
              color="#2a0808"
              toneMapped={false}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

// ==========================================
// HELPERS
// ==========================================

const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;

// Race-control message, read by the HUD (raceInfo.message, raceInfo.messageAt)
const say = (text) => {
  raceInfo.message = text;
  raceInfo.messageAt = performance.now();
};

const freshRules = () => ({
  penalty: 0,
  violations: 0,
  lapInvalid: false,
  outside: false,
  limitCooldown: 0,
  penaltyCooldown: 0,
  finalTime: null,
});

// ---- AI field generation ----

// Evenly spread paces (slowest .. fastest), shuffled between the AI cars,
// with a little random jitter so no two races have the same running order.
function rollField(count) {
  const base = Array.from({ length: count }, (_, i) => (count === 1 ? 0.5 : i / (count - 1)));

  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }

  return base.map((p) => THREE.MathUtils.clamp(p + (Math.random() - 0.5) * PACE_JITTER, 0, 1));
}

// Put an AI car back on the grid with a fresh personality for this race
function resetDriver(o, index, pace) {
  Object.assign(o, {
    // grid
    distance: -(index + 1) * GRID_GAP,
    speed: 0,
    laneOffset: 0,
    lat: o.lane,
    finishTime: null,

    // pace / personality
    pace,
    maxSpeed: AI_SPEED_MIN + pace * (AI_SPEED_MAX - AI_SPEED_MIN),
    gripScale: AI_GRIP_MIN + pace * (AI_GRIP_MAX - AI_GRIP_MIN),
    // Cache the expensive look-ahead braking calculation between frames.
    brakeTarget: AI_SPEED_MIN + pace * (AI_SPEED_MAX - AI_SPEED_MIN),
    smoothedTarget: AI_SPEED_MIN + pace * (AI_SPEED_MAX - AI_SPEED_MIN),
    brakeTargetTimer: 0,
    // Noticeable differences in acceleration and launch reaction.
    power: 0.62 + pace * 0.16,
    reaction: 0.08 + Math.random() * (0.62 - pace * 0.30),
    form: 0.97 + Math.random() * 0.06,
    formTarget: 0.97 + Math.random() * 0.06,
    formTimer: 2.5 + Math.random() * 4.5,
    mistake: 0,
    mistakeSeverity: 0,
    mistakeIn: (12 + Math.random() * 22) * (0.7 + pace * 0.8),

    // overtaking
    passSide: 0,
    passHold: 0,
    passTarget: 0,
    passOffset: 0,

    // collision reaction
    impactTimer: 0,
    impactDirection: 0,
    impactOffset: 0,
    impactYaw: 0,
    collisionCooldown: 0,
  });
}

// Build the final six-driver classification before ending the game.
// AI cars that have not crossed the line receive a projected finish time.
function buildFinalClassification({ state, opponents }) {
  const playerDriver = DRIVERS[0] || {};
  // Use actual chequered-flag crossing time for classification.
  // Time penalties remain visible separately and do not change the position.
  const playerTime = state.finishTime ?? state.elapsed;

  const entries = [
    {
      ...playerDriver,
      player: true,
      time: playerTime,
      est: false,
    },
    ...opponents.map((opponent, index) => {
      const finished = opponent.finishTime !== null;
      const projectedTime = finished
        ? opponent.finishTime
        : state.elapsed +
          Math.max(0, TOTAL - opponent.distance) /
            Math.max(opponent.speed, 20);

      return {
        ...(DRIVERS[index + 1] || {}),
        player: false,
        time: projectedTime,
        est: !finished,
      };
    }),
  ];

  entries.sort((a, b) => a.time - b.time);

  const winnerTime = entries[0]?.time ?? 0;

  return entries.map((entry, index) => ({
    ...entry,
    position: index + 1,
    gap: Math.max(0, entry.time - winnerTime),
  }));
}

// ==========================================
// RACE COMPONENT
// ==========================================

export default function Race({ carRef, hudRef, paused = false }) {
  const { scene } = useGLTF("/models/Red_bull_car.glb");
  const lightMats = useRef([]);

  // AI OPPONENTS
  const opponents = useMemo(() => {
    const paces = rollField(AI_COLORS.length);

    return AI_COLORS.map((color, index) => {
      const teamColor = new THREE.Color(color);

      const object = prepareCarModel(scene, (m) => {
        const hsl = {};
        m.color?.getHSL(hsl);

        if (m.color && hsl.s > 0.12 && hsl.l > 0.16 && hsl.l < 0.88) {
          m.color.copy(teamColor).multiplyScalar(Math.max(0.72, hsl.l * 1.35));
        }
      });

      const o = {
        object,
        bodyRef: { current: null },
        lane: index % 2 === 0 ? -3 : 3,
      };

      resetDriver(o, index, paces[index]);
      return o;
    });
  }, [scene]);

  const race = useRef({
    phase: "ready",
    distance: PLAYER_START_DISTANCE,
    sampleIndex: Math.round(startT * SAMPLES) % SAMPLES,
    completedLaps: 0,
    elapsed: 0,
    lapStartedAt: 0,
    bestLap: null,
    lastLap: null,
    finishTime: null,
    finishPosition: 0,
    leaderboardTimer: 0,
    gridTimer: 0,
    gridHold: 1.2,
    litShown: -1,
    sector: 1,
    sectorStart: 0,
    sectorTimes: [null, null, null],
    resetToken: 0,
    ...freshRules(),
  });

  // AI COLLISION REACTION + "CAUSING A COLLISION" PENALTY
  const handleAICollision = (index) => {
    const opponent = opponents[index];
    const playerBody = carRef.current;
    const aiBody = opponent?.bodyRef.current;

    if (!opponent || !playerBody || !aiBody || opponent.collisionCooldown > 0) return;

    const playerPosition = playerBody.translation();
    const aiPosition = aiBody.translation();
    const q = aiBody.rotation();
    const aiRotation = new THREE.Quaternion(q.x, q.y, q.z, q.w);

    const aiRight = new THREE.Vector3(1, 0, 0).applyQuaternion(aiRotation);
    const aiForward = new THREE.Vector3(0, 0, 1).applyQuaternion(aiRotation);

    const dx = playerPosition.x - aiPosition.x;
    const dz = playerPosition.z - aiPosition.z;

    opponent.impactDirection = dx * aiRight.x + dz * aiRight.z >= 0 ? -1 : 1;
    opponent.impactTimer = 1.5;
    opponent.collisionCooldown = 0.55;
    opponent.speed *= 0.72;

    // Hitting a car from behind at speed = 5 second penalty
    const v = playerBody.linvel();
    const s = race.current;
    const fromBehind = dx * aiForward.x + dz * aiForward.z < -1;

    if (
      fromBehind &&
      Math.hypot(v.x, v.z) > 8 &&
      s.phase === "playing" &&
      grid.go &&
      s.finishTime === null &&
      s.penaltyCooldown <= 0
    ) {
      s.penalty += PENALTY;
      s.penaltyCooldown = 3;
      say(`${PENALTY} SECOND PENALTY - CAUSING A COLLISION`);
    }
  };

  // ==========================================
  // MAIN RACE LOOP
  // ==========================================

  useFrame((_, delta) => {
    // Freeze race simulation updates while the pause menu is open.
    if (paused) return;

    const body = carRef.current;
    if (!body) return;

    const dt = Math.min(delta, 0.05);
    const state = race.current;
    const phase = game.get().phase;
    const running = phase === "playing";

    // ---- new race ----
    if (running && state.phase !== "playing") {
      // New pace order for every race
      const paces = rollField(opponents.length);

      opponents.forEach((o, index) => {
        resetDriver(o, index, paces[index]);

        const { x, z, yaw } = laneXZ(o.distance, o.lane);

        o.bodyRef.current?.setTranslation({ x, y: 0.42, z }, true);
        o.bodyRef.current?.setRotation(
          { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
          true
        );
      });

      Object.assign(state, {
        distance: PLAYER_START_DISTANCE,
        sampleIndex: Math.round(startT * SAMPLES) % SAMPLES,
        completedLaps: 0,
        elapsed: 0,
        lapStartedAt: 0,
        bestLap: null,
        lastLap: null,
        finishTime: null,
        finishPosition: 0,
        leaderboardTimer: 0,
        gridTimer: 0,
        gridHold: 0.15 + Math.random() * 0.25,
        sector: 1,
        sectorStart: 0,
        sectorTimes: [null, null, null],
        resetToken: track.resetToken,
        ...freshRules(),
      });

      raceInfo.message = "";
      raceInfo.results = null;
      raceInfo.lapTimes = []; // MOBILE-FIX (A)
      raceInfo.topSpeed = 0; // MOBILE-FIX (A)
      raceInfo.finished = false;
      grid.go = false;
      grid.lights = 0;
      grid.count = 3;
      grid.active = false;
    }

    state.phase = phase;
    state.limitCooldown = Math.max(0, state.limitCooldown - dt);
    state.penaltyCooldown = Math.max(0, state.penaltyCooldown - dt);

    // ---- start sequence: 3 - 2 - 1, lights build up, lights out = GO ----
    if (!running) {
      grid.go = false;
      grid.lights = 0;
      grid.count = 0;
      grid.active = false;
    } else if (!grid.go) {
      state.gridTimer += dt;
      grid.active = true;

      // 3 - 2 - 1, then the lights go out after a short random hold
      grid.count = Math.max(1, 3 - Math.floor(state.gridTimer));
      grid.lights = Math.min(5, Math.floor(state.gridTimer / 0.6) + 1);

      if (state.gridTimer >= 3 + state.gridHold) {
        grid.go = true;
        grid.goAt = performance.now();
        grid.lights = 0;
        grid.count = 0;
        grid.active = false;
        say("LIGHTS OUT");
      }
    } else {
      grid.active = false;
    }

    if (state.litShown !== grid.lights) {
      state.litShown = grid.lights;

      lightMats.current.forEach((material, index) => {
        if (!material) return;

        if (Math.floor(index / 2) < grid.lights) material.color.setRGB(7, 0.25, 0.25);
        else material.color.setRGB(0.16, 0.03, 0.03);
      });
    }

    const racing = running && grid.go && state.finishTime === null;

    state.elapsed += dt;

    // Player speed (needed by the AI so it can react to the player's car)
    const lv = body.linvel();
    const playerSpeed = Math.hypot(lv.x, lv.z);

    // Top speed for the results screen (km/h)
    if (racing) raceInfo.topSpeed = Math.max(raceInfo.topSpeed || 0, playerSpeed * 3.6); // MOBILE-FIX (B)

    // ---- AI opponents ----
    opponents.forEach((o, oi) => {
      const AI_BRAKE = 38;

      if (racing) {
        // Random form: pace drifts a little up and down during the race
        o.formTimer -= dt;
        if (o.formTimer <= 0) {
          // Driver form changes over a stint; each AI has its own pace rhythm.
          o.formTarget = 0.955 + Math.random() * 0.09;
          o.formTimer = 4 + Math.random() * 7;
        }
        o.form = THREE.MathUtils.damp(o.form, o.formTarget, 0.8, dt);

        // Occasional mistakes (lock-up, running wide): slower drivers make more of them
        o.mistakeIn -= dt;
        if (o.mistake > 0) {
          o.mistake -= dt;
        } else if (o.mistakeIn <= 0) {
          // Lower-rated drivers make mistakes more often and lose more time.
          o.mistake = 0.7 + Math.random() * 1.4;
          o.mistakeSeverity = (0.07 + Math.random() * 0.16) * (1.25 - o.pace * 0.55);
          o.mistakeIn = (8 + Math.random() * 18) * (0.65 + o.pace * 1.0);
        }
        const mistakeScale = o.mistake > 0 ? 1 - o.mistakeSeverity : 1;

        if (o.reaction > 0) {
          // Waiting for the launch (each driver reacts to the lights differently)
          o.reaction -= dt;
        } else {
          // ---- look for a car ahead (other AI or the player) ----
          let blocker = null;
          let blockGap = Infinity;
          let alongside = false;

          const scan = (distance, lat, speed) => {
            const gap = distance - o.distance;
            const sideways = Math.abs(lat - o.lat);

            if (Math.abs(gap) < 7 && sideways < 3.4) alongside = true;
            if (gap <= 0 || gap > PASS_LOOKAHEAD || sideways > 3) return;

            if (gap < blockGap) {
              blockGap = gap;
              blocker = { lat, speed };
            }
          };

          scan(state.distance, track.offset, playerSpeed);
          opponents.forEach((other, oj) => {
            if (oj !== oi) scan(other.distance, other.lat, other.speed);
          });

          // ---- overtaking: pull out and go around a slower car ----
          const closing = blocker && (o.speed - blocker.speed > 1 || blockGap < 8);

          if (closing) {
            if (o.passSide === 0) {
              let side = o.lat >= blocker.lat ? 1 : -1;
              if (Math.abs(blocker.lat + side * PASS_CLEARANCE) > LAT_LIMIT) side = -side;
              o.passSide = side;
            }

            o.passHold = 0.8;
            o.passTarget =
              THREE.MathUtils.clamp(blocker.lat + o.passSide * PASS_CLEARANCE, -LAT_LIMIT, LAT_LIMIT) -
              (o.lane + o.laneOffset);
          } else if (o.passSide !== 0) {
            // Do not cut back in while still alongside someone
            if (alongside) o.passHold = Math.max(o.passHold, 0.3);
            o.passHold -= dt;

            if (o.passHold <= 0) {
              o.passSide = 0;
              o.passTarget = 0;
            }
          }

          // ---- speed: corner/braking limit x form x rubber band x mistake x slipstream ----
          // Cache the look-ahead scan to avoid doing expensive work every frame.
          // Refresh at 10 Hz, then smoothly follow the new target speed.
          o.brakeTargetTimer -= dt;
          if (o.brakeTargetTimer <= 0) {
            o.brakeTarget = brakingTarget(
              o.distance,
              o.maxSpeed,
              o.gripScale,
              AI_BRAKE,
            );
            o.brakeTargetTimer = 0.1;
          }
          let target = o.brakeTarget;
          o.smoothedTarget = THREE.MathUtils.damp(
            o.smoothedTarget ?? target,
            target,
            4.5,
            dt,
          );
          target = o.smoothedTarget;

          // Mild rubber band: cars far ahead of the player ease off, cars far behind push
          const gapToPlayer = o.distance - state.distance;
          const rubber =
            1 - THREE.MathUtils.clamp(gapToPlayer / RUBBER_RANGE, -1, 1) * RUBBER_BAND;

          // Slipstream: closing up in the wake of the car ahead
          let tow = 0;
          if (blocker && Math.abs(blocker.lat - o.lat) < 2.2) {
            tow = THREE.MathUtils.clamp(1 - blockGap / PASS_LOOKAHEAD, 0, 1);
          }

          target *= o.form * rubber * mistakeScale * (1 + 0.03 * tow);
          target = Math.min(target, o.maxSpeed * 1.04);

          // Stuck right behind a car in the same line: match its speed until there is room to pass
          if (blocker && blockGap < 10 && Math.abs(blocker.lat - o.lat) < 2.4) {
            target = Math.min(target, Math.max(0, blocker.speed + (blockGap - 6) * 0.8));
          }

          if (o.speed > target) {
            o.speed = Math.max(target, o.speed - AI_BRAKE * dt);
          } else {
            const acceleration = THREE.MathUtils.clamp(5.5 - 0.045 * o.speed, 1.2, 4.8) * o.power;
            o.speed = Math.min(target, o.speed + acceleration * dt);
          }

          o.distance += o.speed * dt;

          if (o.finishTime === null && o.distance >= TOTAL) o.finishTime = state.elapsed;
        }
      }

      o.impactTimer = Math.max(0, o.impactTimer - dt);
      o.collisionCooldown = Math.max(0, o.collisionCooldown - dt);

      const impact = THREE.MathUtils.smoothstep(o.impactTimer, 0, 1.5);

      o.impactOffset = THREE.MathUtils.damp(o.impactOffset, o.impactDirection * 2.1 * impact, 3.2, dt);
      o.impactYaw = THREE.MathUtils.damp(o.impactYaw, o.impactDirection * 0.24 * impact, 3.2, dt);

      // Racing line: drift toward the inside of corners
      const k = curvature[Math.floor(wrap(o.distance) / DS) % SAMPLES];
      const cornerWeight = THREE.MathUtils.clamp(Math.abs(k) / 0.006, 0, 1);
      const targetLane = o.lane + Math.sign(k) * cornerWeight * 2.5;

      o.laneOffset = THREE.MathUtils.damp(o.laneOffset, targetLane - o.lane, 1.5, dt);

      // Smoothly move out to (or back from) an overtaking line
      o.passOffset = THREE.MathUtils.damp(o.passOffset, o.passTarget, 2.2, dt);

      const lateral = THREE.MathUtils.clamp(
        o.lane + o.laneOffset + o.passOffset + o.impactOffset,
        -LAT_LIMIT,
        LAT_LIMIT
      );
      o.lat = lateral;

      const { x, z, yaw: baseYaw } = laneXZ(o.distance, lateral);
      const yaw = baseYaw + o.impactYaw;

      const mc =
        mapCars[oi + 1] ||
        (mapCars[oi + 1] = { color: DRIVERS[oi + 1].color, player: false, x: 0, z: 0, yaw: 0 });
      mc.x = x;
      mc.z = z;
      mc.yaw = yaw;

      o.bodyRef.current?.setNextKinematicTranslation({ x, y: 0.42, z });
      o.bodyRef.current?.setNextKinematicRotation({
        x: 0,
        y: Math.sin(yaw / 2),
        z: 0,
        w: Math.cos(yaw / 2),
      });
    });

    // ---- player position on track ----
    const position = body.translation();

    const rq = body.rotation();
    const pc =
      mapCars[0] ||
      (mapCars[0] = { color: DRIVERS[0].color, player: true, x: 0, z: 0, yaw: 0 });
    pc.x = position.x;
    pc.z = position.z;
    pc.yaw = 2 * Math.atan2(rq.y, rq.w);

    // Car was put back on the grid (R key)
    if (state.resetToken !== track.resetToken) {
      state.resetToken = track.resetToken;
      state.sampleIndex = Math.round(startT * SAMPLES) % SAMPLES;
      state.distance = state.completedLaps * TRACK_LENGTH + PLAYER_START_DISTANCE;
      state.sector = 1;
      state.sectorStart = state.elapsed;
    }

    const searchNearest = (from, to) => {
      let best = Infinity;
      let bestIndex = state.sampleIndex;

      for (let offset = from; offset <= to; offset++) {
        const index = (state.sampleIndex + offset + SAMPLES) % SAMPLES;
        const dx = points[index].x - position.x;
        const dz = points[index].z - position.z;
        const d = dx * dx + dz * dz;

        if (d < best) {
          best = d;
          bestIndex = index;
        }
      }

      return [best, bestIndex];
    };

    let [nearestSq, nearestIndex] = searchNearest(-35, 35);
    if (nearestSq > 40 * 40) [nearestSq, nearestIndex] = searchNearest(0, SAMPLES - 1);

    let sampleDelta = nearestIndex - state.sampleIndex;
    if (sampleDelta > SAMPLES / 2) sampleDelta -= SAMPLES;
    if (sampleDelta < -SAMPLES / 2) sampleDelta += SAMPLES;

    if (running && state.finishTime === null) {
      state.distance += (sampleDelta / SAMPLES) * TRACK_LENGTH;
    }

    state.sampleIndex = nearestIndex;

    // ---- surface and track limits ----
    const signedOffset =
      (position.x - points[nearestIndex].x) * normals[nearestIndex].x +
      (position.z - points[nearestIndex].z) * normals[nearestIndex].z;

    const absOffset = Math.abs(signedOffset);

    track.offset = signedOffset;
    track.index = nearestIndex;
    track.surface =
      absOffset <= TRACK_WIDTH
        ? "track"
        : absOffset <= TRACK_WIDTH + KERB_WIDTH
          ? "kerb"
          : absOffset <= RUNOFF_END
            ? "runoff"
            : "gravel";
    track.off = track.surface === "runoff" || track.surface === "gravel";

    // All four wheels over the white line: lap deleted, every 3rd offence = 5 s penalty
    const outside = absOffset > LIMIT;

    if (racing && outside && !state.outside && state.limitCooldown <= 0) {
      state.violations += 1;
      state.lapInvalid = true;
      state.limitCooldown = 1.5;

      if (state.violations % LIMITS_PER_PENALTY === 0) {
        state.penalty += PENALTY;
        say(`${PENALTY} SECOND PENALTY - TRACK LIMITS`);
      } else {
        say(`TRACK LIMITS - LAP DELETED (${state.violations % LIMITS_PER_PENALTY}/${LIMITS_PER_PENALTY})`);
      }
    }

    state.outside = outside;

    // ---- DRS: zones only, from lap 2, within 1 s of the car ahead ----
    let ahead = Infinity;
    opponents.forEach((o) => {
      const d = o.distance - state.distance;
      if (d > 0 && d < ahead) ahead = d;
    });

    const gapAhead = ahead / Math.max(playerSpeed, 20);
    const inZone = drsZone[nearestIndex];

    track.drsAllowed =
      racing &&
      (!DRS_RULES || (inZone && state.completedLaps + 1 >= DRS_FROM_LAP && gapAhead < DRS_GAP));

    // ---- laps, finish, sectors ----
    if (running && state.finishTime === null) {
      const completed = Math.max(0, Math.floor(state.distance / TRACK_LENGTH));

      if (completed > state.completedLaps) {
        const lapTime = state.elapsed - state.lapStartedAt;

        state.lastLap = lapTime;
        (raceInfo.lapTimes ||= []).push({ time: lapTime, invalid: state.lapInvalid }); // MOBILE-FIX (C)
        raceInfo.lastLapInvalid = state.lapInvalid;

        // Lap 1 is a standing start; deleted laps never count as best
        if ((state.completedLaps >= 1 || LAPS === 1) && !state.lapInvalid) {
          state.bestLap = state.bestLap === null ? lapTime : Math.min(state.bestLap, lapTime);
        }

        state.lapInvalid = false;
        state.completedLaps = completed;
        state.lapStartedAt = state.elapsed;

        if (completed >= LAPS) {
          state.finishTime = state.elapsed;
          // Keep the crossing time unchanged; display the penalty separately.
          state.finalTime = state.finishTime;

          // Classification: actual crossing times; unfinished cars projected (penalty shown separately)
          state.finishPosition =
            1 +
            opponents.filter(
              (o) =>
                (o.finishTime ??
                  state.elapsed + Math.max(0, TOTAL - o.distance) / Math.max(o.speed, 20)) <
                state.finalTime
            ).length;

          // Publish the complete classification before changing phase to "over".
          // RaceResults watches for both phase === "over" and raceInfo.results.
          raceInfo.results = buildFinalClassification({ state, opponents });
          raceInfo.bestLap = state.bestLap;
          raceInfo.penalty = state.penalty;
          raceInfo.violations = state.violations;
          raceInfo.finished = true;

          // Keep the HUD position consistent with the final classification.
          state.finishPosition =
            raceInfo.results.find((row) => row.player)?.position ?? state.finishPosition;

          say("CHEQUERED FLAG");
          game.end();
        }
      }

      const lapDistance = state.distance - state.completedLaps * TRACK_LENGTH;
      const sector =
        lapDistance < 0 ? 1 : Math.min(3, Math.floor((lapDistance / TRACK_LENGTH) * 3) + 1);

      const forwardStep = sector === state.sector + 1 || (state.sector === 3 && sector === 1);

      if (sector !== state.sector && forwardStep) {
        state.sectorTimes[state.sector - 1] = state.elapsed - state.sectorStart;
        state.sector = sector;
        state.sectorStart = state.elapsed;
      }
    }

    // ---- live leaderboard ----
    state.leaderboardTimer += dt;

    if (running && state.leaderboardTimer >= 0.2) {
      state.leaderboardTimer = 0;

      const racers = [
        { ...DRIVERS[0], distance: state.distance, speed: playerSpeed },
        ...opponents.map((o, i) => ({ ...DRIVERS[i + 1], distance: o.distance, speed: o.speed })),
      ].sort((a, b) => b.distance - a.distance);

      const leader = racers[0];

      game.setLeaderboard(
        racers.map((driver, index) => ({
          ...driver,
          position: index + 1,
          progress: driver.distance,
          gap:
            index === 0
              ? "LEADER"
              : `+${(Math.max(0, leader.distance - driver.distance) / Math.max(leader.speed, 20)).toFixed(1)}s`,
        }))
      );
    }

    // ---- shared race info + HUD ----
    const playerRank = 1 + opponents.filter((o) => o.distance > state.distance).length;
    const currentLap = Math.min(LAPS, state.completedLaps + 1);

    Object.assign(raceInfo, {
      lap: currentLap,
      laps: LAPS,
      position: playerRank,
      total: opponents.length + 1,
      sector: state.sector,
      lapTime: Math.max(0, (state.finishTime ?? state.elapsed) - state.lapStartedAt),
      lastLap: state.lastLap,
      bestLap: state.bestLap,
      sectorTimes: state.sectorTimes,
      elapsed: state.elapsed,
      finished: state.finishTime !== null,
      penalty: state.penalty,
      violations: state.violations,
      lapInvalid: state.lapInvalid,
      finalTime: state.finalTime,
      drsZone: inZone,
      drsAvailable: track.drsAllowed,
      gapAhead: Number.isFinite(gapAhead) ? gapAhead : null,
    });

    if (hudRef?.current) {
      const best = state.bestLap !== null ? ` · BEST ${formatTime(state.bestLap)}` : "";
      const pen = state.penalty ? ` · +${state.penalty}S` : "";
      const total = opponents.length + 1;

      hudRef.current.textContent =
        state.finishTime !== null
          ? `FINISHED · P${state.finishPosition} · ${formatTime(state.finalTime)}${pen}`
          : `P${playerRank}/${total} · LAP ${currentLap}/${LAPS} · ${formatTime(state.elapsed)}${best}${pen}`;
    }
  });

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <>
      {trackMeshes.map((geometry, index) => (
        <mesh key={index} geometry={geometry} receiveShadow>
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            roughness={0.92}
            polygonOffset
            polygonOffsetFactor={-index - 1}
            polygonOffsetUnits={-index - 1}
          />
        </mesh>
      ))}

      <StartLine lightMats={lightMats} />
      <GridBoxes />

      <InstancedItems items={barrierItems}>
        <boxGeometry args={[0.5, 1.2, BARRIER_LENGTH]} />
      </InstancedItems>

      <InstancedItems items={tyreItems}>
        <cylinderGeometry args={[0.5, 0.5, 0.5, 14]} />
      </InstancedItems>

      <InstancedItems items={drsItems}>
        <boxGeometry args={[0.3, 3, 5]} />
      </InstancedItems>

      {opponents.map((o, index) => {
        const { x, z, yaw } = laneXZ(-(index + 1) * GRID_GAP, o.lane);

        return (
          <RigidBody
            key={index}
            ref={(b) => {
              o.bodyRef.current = b;
            }}
            type="kinematicPosition"
            colliders={false}
            position={[x, 0.42, z]}
            rotation={[0, yaw, 0]}
            name={`ai-car-${index}`}
            onCollisionEnter={() => handleAICollision(index)}
            enabledRotations={[false, true, false]}
            canSleep={false}
          >
            <CuboidCollider args={[1.03, 0.42, 2.7]} friction={0.9} restitution={0.02} />
            <primitive object={o.object} />
          </RigidBody>
        );
      })}
    </>
  );
}