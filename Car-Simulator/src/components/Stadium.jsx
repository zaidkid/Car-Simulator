import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { curve } from "./Trackcurve";

// APEX RACING - F1 trackside environment v6
// Improvements in v6:
// - Fine FIA catch-fence mesh + horizontal tension cables (eliminates giant X lattice)
// - Multi-material building boxes (prevents window textures stretching across roofs)
// - Dynamic curvature-compensated segment lengths (zero gaps on outer grandstand curves)
// - Cantilever floodlight rigs, corner brake markers, pit-wall canopies & broadcast chopper
// - Selective shadow casting & mipmapped crowd textures to eliminate distant shimmering

const PHONE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const TRACK_OFFSET = 34; // distance from the centre line to the ad wall area
const BASE = 3; // grandstands start this far beyond TRACK_OFFSET
const TILT = 0.13;

const L = curve.getLength();
const SEGMENTS = Math.round(L / (PHONE ? 38 : 30));
const LEN = (L / SEGMENTS) * 1.03;

// Clearance check: distance to the nearest part of the track that is NOT nearby
// along the lap, so nothing is built on top of another section of the circuit
const N = PHONE ? 480 : 640;
const trackPts = Array.from({ length: N }, (_, j) => curve.getPointAt(j / N));
const farMin = (x, z, t) => {
  let m = Infinity;
  for (let j = 0; j < N; j++) {
    const d = Math.abs(j / N - t);
    if (Math.min(d, 1 - d) * L < 60) continue;
    const dx = trackPts[j].x - x;
    const dz = trackPts[j].z - z;
    m = Math.min(m, dx * dx + dz * dz);
  }
  return Math.sqrt(m);
};

// Centre and radius of the whole circuit (used by the hills, skyline and blimp)
let CX = 0;
let CZ = 0;
trackPts.forEach((p) => {
  CX += p.x;
  CZ += p.z;
});
CX /= N;
CZ /= N;

let TRACK_R = 0;
trackPts.forEach((p) => {
  TRACK_R = Math.max(TRACK_R, Math.hypot(p.x - CX, p.z - CZ));
});

const rnd = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const pick = (arr, n) => arr[Math.floor(Math.abs(n)) % arr.length];

const SEAT = ["#1e3a6e", "#2b5299", "#c8102e", "#e9edf2", "#f5a623", "#152238"];
const BLDG = ["#f4f1ea", "#e8ecf1", "#ffffff", "#f0dfc8", "#d8e4ee"];
const GLASS = ["#ffffff", "#dbe8f5", "#c9dcef", "#eef4fa", "#d4f0f0"];
const GREENS = ["#2f7a38", "#3f8f40", "#2a6a34", "#55a046", "#2f8a4a"];
const GRASS = ["#46893a", "#529944"];
const FAR = ["#c8d4e0", "#b9c8d8", "#d9e2ec", "#aebfd0"];
const TIERS = [28, 44, 62];
const TEAMS = ["#3671ff", "#e10600", "#ff8700", "#00d2be", "#0b1b3a"];

// ---------- procedural textures ----------
const tex = (w, h, draw) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = PHONE ? 2 : 8;
  return t;
};

const BRANDS = [
  ["APEX", "#1e4fa3", "#ffffff"],
  ["VELOCITY", "#f2f5f9", "#c8102e"],
  ["NOVA", "#111827", "#ffd23f"],
  ["TURBO", "#c8102e", "#ffffff"],
  ["QUANTUM", "#f2f5f9", "#1e4fa3"],
  ["ZENITH", "#0f766e", "#ffffff"],
  ["ORBIT", "#ff8700", "#111827"],
  ["HELIX", "#1e293b", "#38bdf8"],
];

const adTex = (flip, repeat = 1) => {
  const t = tex(2048, 192, (g, w, h) => {
    BRANDS.forEach(([name, bg, fg], i) => {
      const x = i * 256;

      g.fillStyle = bg;
      g.fillRect(x, 0, 256, h);

      // crisp top & bottom border trim
      g.fillStyle = "rgba(0,0,0,0.18)";
      g.fillRect(x, 0, 256, 8);

      // soft diagonal accent
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.beginPath();
      g.moveTo(x + 175, 0);
      g.lineTo(x + 256, 0);
      g.lineTo(x + 220, h);
      g.lineTo(x + 140, h);
      g.fill();

      // shrink the text until it fits
      let size = 62;
      g.textAlign = "center";
      g.textBaseline = "middle";
      do {
        g.font = `italic 900 ${size}px Arial`;
        size -= 2;
      } while (g.measureText(name).width > 214 && size > 20);

      g.fillStyle = fg;
      g.fillText(name, x + 128, h / 2 - 4);

      g.fillStyle = "#e10600";
      g.fillRect(x, h - 14, 256, 14);
    });
  });

  t.repeat.x = flip ? -repeat : repeat;
  if (flip) t.offset.x = repeat;
  return t;
};

// High-density stadium crowd texture (avoids blocky stretching on grandstands)
const crowdTex = tex(1024, 256, (g, w, h) => {
  g.fillStyle = "#18202c";
  g.fillRect(0, 0, w, h);

  const shirts = [
    "#f3f4f6", "#e10600", "#2563eb", "#fbbf24", "#1f2937",
    "#9ca3af", "#00d2be", "#ff8700", "#ffffff", "#3b82f6",
  ];
  const skins = ["#f1c9a5", "#c68e63", "#8d5a3b", "#e8b896", "#5e3b26"];

  for (let row = 0; row < 4; row++) {
    const baseY = 38 + row * 52;
    // subtle aisle step shadow
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0, baseY + 34, w, 12);

    for (let x = 4; x < w; x += 14 + (rnd(x * (row + 1)) * 8)) {
      if (rnd(x + row * 19) < 0.08) continue;
      const y = baseY + (rnd(x * 3.1 + row) - 0.5) * 8;

      // shoulders/torso
      g.fillStyle = shirts[Math.floor(rnd(x * 7.3 + row * 13) * shirts.length)];
      g.beginPath();
      g.roundRect(x, y + 10, 14, 30, 4);
      g.fill();

      // head/cap
      const hasCap = rnd(x * 2.3 + row) < 0.35;
      g.fillStyle = hasCap
        ? shirts[Math.floor(rnd(x * 5.1 + row) * shirts.length)]
        : skins[Math.floor(rnd(x * 11.7 + row) * skins.length)];
      g.beginPath();
      g.arc(x + 7, y + 6, 5.5, 0, Math.PI * 2);
      g.fill();
    }
  }
});
crowdTex.repeat.set(2.5, 1);

// FIA-style catch fence: fine wire mesh + horizontal steel tension cables
const netTex = tex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);

  // Horizontal steel tension cables
  g.strokeStyle = "rgba(30, 36, 44, 0.85)";
  g.lineWidth = 3.5;
  for (const y of [16, 48, 80, 112]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }

  // Fine chain-link diamond wire
  g.strokeStyle = "rgba(42, 50, 60, 0.72)";
  g.lineWidth = 2.2;
  const step = 32;
  for (let x = -w; x <= w * 2; x += step) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + h, h);
    g.moveTo(x + h, 0);
    g.lineTo(x, h);
    g.stroke();
  }
});
netTex.repeat.set(LEN * 0.85, 1.8);

// Big screen content with live timing leaderboard graphics
const screenTex = tex(512, 256, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#081229");
  grad.addColorStop(1, "#122a5c");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  // Top & bottom broadcast bars
  g.fillStyle = "#e10600";
  g.fillRect(0, 0, w, 18);
  g.fillStyle = "#0f172a";
  g.fillRect(0, h - 28, w, 28);

  // Left live timing sidebar on the jumbo screen
  g.fillStyle = "rgba(15, 23, 42, 0.85)";
  g.fillRect(14, 28, 130, h - 66);
  const drivers = [
    ["1", "VER", "#3671ff"],
    ["2", "HAM", "#e10600"],
    ["3", "NOR", "#ff8700"],
    ["4", "LEC", "#e10600"],
  ];
  g.font = "bold 20px Arial";
  drivers.forEach(([pos, code, col], idx) => {
    const y = 52 + idx * 38;
    g.fillStyle = col;
    g.fillRect(22, y - 14, 5, 22);
    g.fillStyle = "#ffffff";
    g.textAlign = "left";
    g.fillText(`${pos}  ${code}`, 34, y);
  });

  // Main broadcast feed graphic
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "italic 900 54px Arial";
  g.fillText("APEX RACING", w * 0.63, h / 2 - 20);
  g.font = "700 22px Arial";
  g.fillStyle = "#38bdf8";
  g.fillText("WORLD CHAMPIONSHIP · LIVE", w * 0.63, h / 2 + 28);
});

// Building facades: 4 columns x 4 floors per tile (deterministic architectural windows)
const facadeBase = {
  glass: tex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#8ab4d6");
    grad.addColorStop(1, "#4b7496");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    for (let r = 0; r < 4; r++) {
      // spandrel glass band between floors
      g.fillStyle = "#243748";
      g.fillRect(0, r * 64, w, 10);

      for (let c = 0; c < 4; c++) {
        const seed = r * 17 + c * 31;
        const lit = rnd(seed) < 0.14;
        g.fillStyle = lit
          ? "#fdf0b8"
          : `rgba(${25 + rnd(seed + 1) * 20},${55 + rnd(seed + 2) * 30},${90 + rnd(seed + 3) * 35},0.7)`;
        g.fillRect(c * 64 + 4, r * 64 + 12, 56, 48);

        // subtle vertical curtain-wall reflection highlight
        g.fillStyle = "rgba(255,255,255,0.12)";
        g.fillRect(c * 64 + 8, r * 64 + 12, 12, 48);
      }
    }

    // Mullion grid
    g.strokeStyle = "#1e2d3d";
    g.lineWidth = 4;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64, h);
      g.stroke();
    }
  }),

  concrete: tex(256, 256, (g, w, h) => {
    g.fillStyle = "#e2e6ec";
    g.fillRect(0, 0, w, h);

    for (let r = 0; r < 4; r++) {
      const y = r * 64;

      // architectural precast slab + shadow line
      g.fillStyle = "#cfd6df";
      g.fillRect(0, y, w, 18);
      g.fillStyle = "#9aa5b4";
      g.fillRect(0, y + 18, w, 3);

      for (let c = 0; c < 4; c++) {
        const seed = r * 23 + c * 41 + 9;
        const lit = rnd(seed) < 0.12;
        g.fillStyle = lit ? "#f5e4a8" : "#2f4154";
        g.fillRect(c * 64 + 8, y + 24, 48, 34);

        // window frame
        g.strokeStyle = "#5c6b7c";
        g.lineWidth = 2;
        g.strokeRect(c * 64 + 8, y + 24, 48, 34);
      }

      // vertical pilasters
      g.fillStyle = "#c4ccd6";
      for (let c = 0; c <= 4; c++) g.fillRect(c * 64 - 3, y + 18, 6, 46);
    }
  }),
};

// Creates a 6-sided material list for buildings so roofs don't stretch window textures
const makeBuildingMaterials = (style, h, metalness, roughness) => {
  const t = facadeBase[style].clone();
  t.needsUpdate = true;
  t.repeat.set(2, Math.round(h / 12));

  const sideMat = new THREE.MeshStandardMaterial({
    map: t,
    metalness,
    roughness,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: style === "glass" ? "#33475b" : "#9aa3ae",
    roughness: 0.85,
    metalness: 0.2,
  });

  // BoxGeometry face order: +x, -x, +y (top), -y (bottom), +z, -z
  return [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
};

// ---------- instancing ----------
const GEOS = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 10),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  flag: new THREE.BoxGeometry(1, 1, 1, 1, 1, 12),
};

// Flag ripple: grows from the pole (z = -0.5) to the free edge (z = +0.5)
const waveShader = (uTime) => (shader) => {
  shader.uniforms.uTime = uTime;
  shader.vertexShader =
    "uniform float uTime;\n" +
    shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       float wv = position.z + 0.5;
       float ph = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.05;
       transformed.x += sin(position.z * 7.0 + uTime * 4.5 + ph) * 12.0 * wv;
       transformed.y += sin(position.z * 5.0 + uTime * 3.2 + ph) * 0.12 * wv;`
    );
};

function Instanced({
  items,
  geo = "box",
  color = "#fff",
  cast = false,
  receive = false,
  wave = false,
  matArray = null,
  ...mat
}) {
  const ref = useRef();
  const uTime = useMemo(() => ({ value: 0 }), []);
  const animateWave = wave && !PHONE;
  const onBeforeCompile = useMemo(
    () => (animateWave ? waveShader(uTime) : undefined),
    [animateWave, uTime]
  );

  useFrame((_, delta) => {
    if (animateWave) uTime.value += Math.min(delta, 0.1);
  });

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || !items.length) return;
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    d.rotation.order = "YXZ";
    items.forEach((it, i) => {
      d.position.set(...it.p);
      d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      d.scale.set(...it.s);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, c.set(it.c || color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, color]);

  if (!items.length) return null;

  return (
    <instancedMesh
      ref={ref}
      key={items.length}
      args={[GEOS[geo], matArray || undefined, items.length]}
      frustumCulled
      castShadow={cast && !PHONE}
      receiveShadow={receive && !PHONE}
    >
      {!matArray && (
        <meshStandardMaterial
          {...mat}
          onBeforeCompile={onBeforeCompile}
          customProgramCacheKey={() =>
            animateWave ? "stadium-wave" : "stadium-plain"
          }
        />
      )}
    </instancedMesh>
  );
}

const MATS = {
  grass: { color: "#4a8f3e", roughness: 0.95, receive: true },
  adsP: { map: adTex(false), roughness: 0.35, receive: true },
  adsN: { map: adTex(true), roughness: 0.35, receive: true },
  net: {
    map: netTex,
    transparent: true,
    alphaTest: 0.18,
    opacity: 0.88,
    side: THREE.DoubleSide,
    roughness: 0.6,
  },
  fpost: { geo: "cyl", color: "#2b333d", metalness: 0.7, roughness: 0.4 },
  seats: { roughness: 0.75, receive: true },
  crowd: { map: crowdTex, roughness: 0.9 },
  rear: { color: "#232c38", roughness: 0.7, cast: true },
  posts: { geo: "cyl", color: "#dfe4ea", metalness: 0.6, roughness: 0.35 },
  steel: { color: "#9aa5b4", metalness: 0.65, roughness: 0.35 },
  roof: {
    color: "#f8fafc",
    emissive: "#1e242b",
    roughness: 0.5,
    side: THREE.DoubleSide,
    cast: true,
  },
  roofUnder: { color: "#8893a2", roughness: 0.8 },
  fascia: { roughness: 0.4 },
  flagpoles: { geo: "cyl", color: "#e8ecf1", metalness: 0.6, roughness: 0.35 },
  flags: { geo: "flag", wave: true, roughness: 0.7, side: THREE.DoubleSide },
  paddock: { color: "#e2e8f0", roughness: 0.6, cast: true, receive: true },
  paddockGlass: { color: "#13263b", metalness: 0.75, roughness: 0.12 },
  paddockRoof: { color: "#cbd5e1", roughness: 0.5, cast: true },
  garage: { roughness: 0.45 },
  bridge: { color: "#e6ebf0", metalness: 0.4, roughness: 0.45, cast: true },
  bridgeBanner: { map: adTex(false, 6), roughness: 0.35 },
  trunks: { geo: "cyl", color: "#4a3524", roughness: 1 },
  leaves: { geo: "ico", roughness: 0.9, cast: true },
  b0: {
    matArray: makeBuildingMaterials("concrete", TIERS[0], 0.1, 0.7),
    cast: true,
  },
  b1: {
    matArray: makeBuildingMaterials("concrete", TIERS[1], 0.1, 0.7),
    cast: true,
  },
  b2: {
    matArray: makeBuildingMaterials("concrete", TIERS[2], 0.1, 0.7),
    cast: true,
  },
  g0: {
    matArray: makeBuildingMaterials("glass", TIERS[0], 0.45, 0.2),
    cast: true,
  },
  g1: {
    matArray: makeBuildingMaterials("glass", TIERS[1], 0.45, 0.2),
    cast: true,
  },
  g2: {
    matArray: makeBuildingMaterials("glass", TIERS[2], 0.45, 0.2),
    cast: true,
  },
  crowns: { color: "#475569", roughness: 0.8 },
  podium: { roughness: 0.7, cast: true, receive: true },
  accent: { roughness: 0.35 },
  spires: { geo: "cyl", color: "#cfd6de", metalness: 0.7, roughness: 0.3 },
  poles: { geo: "cyl", color: "#cbd5e1", metalness: 0.7, roughness: 0.35 },
  lamps: { color: "#ffffff", emissive: "#fff8e7", emissiveIntensity: 2.8 },
  brakeBoard: { roughness: 0.4 },
  marshalHut: { color: "#f8fafc", roughness: 0.6 },
  skyline: { roughness: 0.9 },
  screens: {
    map: screenTex,
    emissiveMap: screenTex,
    emissive: "#ffffff",
    emissiveIntensity: 0.95,
    roughness: 0.3,
  },
};

function generate() {
  const g = Object.fromEntries(Object.keys(MATS).map((k) => [k, []]));

  for (let i = 0; i < SEGMENTS; i++) {
    const t = (i + 0.5) / SEGMENTS;
    const point = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const t2 = curve.getTangentAt((t + 1 / SEGMENTS) % 1);
    const yaw = Math.atan2(tan.x, tan.z);
    const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    // Signed curvature: positive = the corner bends toward the +normal side
    const kn = (tan.x * t2.z - tan.z * t2.x) / (L / SEGMENTS);
    const isMain = t < 0.14 || t > 0.965; // start / finish straight
    const wantStand = isMain || i % 9 < 6;

    // Look ahead for upcoming sharp corner to place 150m/100m/50m brake boards
    const tAhead = (t + 0.035) % 1;
    const tanAhead = curve.getTangentAt(tAhead);
    const tanAhead2 = curve.getTangentAt((tAhead + 1 / SEGMENTS) % 1);
    const knAhead =
      (tanAhead.x * tanAhead2.z - tanAhead.z * tanAhead2.x) / (L / SEGMENTS);

    for (const side of [-1, 1]) {
      const seed = i * 31 + side * 7;
      const inner = side === Math.sign(kn);
      const tight = (r) => inner && Math.abs(kn) > 1 / r;

      // Dynamic length compensation so outer curves don't gap and inner curves don't overlap
      const arcScale = (o) =>
        THREE.MathUtils.clamp(1 - side * kn * (TRACK_OFFSET + o), 0.72, 1.38);

      const free = (o, r) => {
        const p = point
          .clone()
          .addScaledVector(normal, side * (TRACK_OFFSET + o));
        return farMin(p.x, p.z, t) > r;
      };

      const add = (k, o, h, s, c, dt = 0, rz = 0, rx = 0) => {
        const p = point
          .clone()
          .addScaledVector(normal, side * (TRACK_OFFSET + o))
          .addScaledVector(tan, dt);
        g[k].push({ p: [p.x, h, p.z], s, ry: yaw, rz, rx, c });
      };

      const sLenAd = LEN * arcScale(-5);
      const sLenFence = LEN * arcScale(-2);

      // verge, ad wall behind the barrier, catch fence (posts lean inward toward track)
      add("grass", 11, 0.04, [38, 0.08, LEN * arcScale(11)], pick(GRASS, i));
      add(side > 0 ? "adsP" : "adsN", -5, 1.1, [0.4, 2.2, sLenAd]);
      add("net", -2, 3.6, [0.04, 4.8, sLenFence]);

      // Catch fence posts + top curved debris overhang
      if (i % 2 === 0) {
        add("fpost", -2, 3.0, [0.16, 6.0, 0.16], null, 0, -side * 0.06);
        add("fpost", -2.35, 6.05, [0.12, 0.9, 0.12], null, 0, -side * 0.65);
      }

      // Brake marker boards (on outside of approaching sharp corners)
      if (
        Math.abs(knAhead) > 1 / 160 &&
        side === -Math.sign(knAhead) &&
        Math.abs(kn) < 1 / 250 &&
        i % 3 < 3
      ) {
        add(
          "brakeBoard",
          -6.2,
          1.1,
          [1.6, 1.1, 0.15],
          pick(["#111827", "#e10600", "#0f766e"], i)
        );
      }

      // Trackside Marshal Post every 16 segments
      if (i % 16 === 8 && side < 0 && free(1, 25)) {
        add("marshalHut", 0.5, 1.4, [2.6, 2.8, 3.2]);
        add("fascia", 0.5, 2.9, [2.8, 0.25, 3.4], "#ff6b00");
      }

      // paddock + garages + pit-wall telemetry boxes along the start / finish straight
      const paddock = isMain && side > 0 && free(14, 42);

      if (paddock) {
        add("paddock", 14, 4.2, [12, 8.4, LEN]);
        add("garage", 7.8, 1.8, [0.35, 3.2, LEN * 0.72], pick(TEAMS, i));
        add("paddockGlass", 7.9, 5.8, [0.18, 2.4, LEN * 0.96]); // VIP hospitality lounge
        add("paddockRoof", 11.2, 8.5, [15.5, 0.35, LEN]); // overhanging modern wing roof

        // Pit wall timing stand right behind the trackside ad wall
        if (i % 2 === 0) {
          add("paddockGlass", -3.8, 2.4, [1.4, 1.5, 4.2]);
          add("paddockRoof", -3.8, 3.25, [1.8, 0.18, 4.6], pick(TEAMS, i));
        }
      }

      // grandstand: more rows on the main straight, never on a tight inside corner
      const rows = isMain ? 12 : 8;
      const stand =
        wantStand &&
        !(isMain && side > 0) &&
        !tight(140) &&
        free(BASE + rows * 0.8, 32 + rows * 0.8);

      if (stand) {
        const width = rows * 1.6;
        const oEnd = BASE + width;
        const top = 1.2 + (rows - 1) * 0.8;
        const roofH = 5.4 + rows * 0.8;
        const sLenStand = LEN * arcScale(BASE + width * 0.5);

        // some sections are painted in a team colour
        const section = i % 7 === 0 ? pick(TEAMS, i >> 1) : null;

        for (let r = 0; r < rows; r++) {
          const o = BASE + 0.8 + r * 1.6;
          const h = 1.2 + r * 0.8;
          const rowLen = LEN * arcScale(o);
          add(
            "seats",
            o,
            h / 2,
            [1.62, h, rowLen],
            section || pick(SEAT, r + (i >> 1))
          );
          // Slight tilt toward the track so crowd planes don't shimmer edge-on
          add(
            "crowd",
            o - 0.15,
            h + 0.45,
            [0.9, 0.95, rowLen * 0.98],
            null,
            0,
            -side * 0.18
          );
        }

        add("rear", oEnd + 0.4, (top + 3) / 2, [0.8, top + 3, sLenStand]);
        add(
          "posts",
          oEnd + 0.6,
          (roofH - 1) / 2,
          [0.9, roofH - 1, 0.9],
          null,
          sLenStand * 0.45
        );
        add("posts", BASE - 1, (roofH - 1) / 2, [0.32, roofH - 1, 0.32]);

        // team-coloured fascia board along the front of the roof
        add(
          "fascia",
          BASE - 1.2,
          roofH - 1.25,
          [0.35, 1.05, sLenStand * 0.99],
          pick(TEAMS, i >> 2)
        );

        // white gabled canopy + underside + ridge beam
        const span = width + 2.4;
        const q = span / 4;
        const o0 = BASE + width / 2;
        const drop = q * Math.tan(TILT);

        for (const [dx, sg] of [
          [-q, -1],
          [q, 1],
        ]) {
          add(
            "roof",
            o0 + dx,
            roofH - drop,
            [span / 2 + 0.25, 0.22, sLenStand * 0.99],
            null,
            0,
            sg * side * TILT
          );
          add(
            "roofUnder",
            o0 + dx,
            roofH - drop - 0.18,
            [span / 2, 0.08, sLenStand * 0.97],
            null,
            0,
            sg * side * TILT
          );
        }
        add("steel", o0, roofH + 0.12, [0.45, 0.45, sLenStand]);

        if (isMain ? i % 5 === 2 : i % 16 === 3) {
          add("screens", oEnd - 0.5, roofH - 3.4, [0.5, 4.4, 9.5]);
        }
      }

      // team flags between the ad wall and the fence (they wave in the wind)
      if (i % 3 === 0 && (stand || isMain)) {
        add("flagpoles", -3, 3.6, [0.12, 7.2, 0.12]);
        add(
          "flags",
          -3,
          6.2,
          [0.04, 1.5, 2.8],
          pick(TEAMS, i + side + 3),
          1.4
        );
      }

      // trees: trunk + 3 leaf blobs
      const to =
        stand || paddock ? 26 + rnd(seed + 5) * 10 : 8 + rnd(seed + 5) * 14;

      if (rnd(seed + 3) > 0.38 && free(to, 32)) {
        const dt = (rnd(seed + 11) - 0.5) * LEN;
        const w = 3.6 + rnd(seed + 9) * 2.2;

        add("trunks", to, 2, [0.5, 4, 0.5], null, dt);
        for (let b = 0; b < 3; b++)
          add(
            "leaves",
            to + (rnd(seed + b * 3) - 0.5) * 2,
            5 + rnd(seed + b * 5) * 1.6,
            [w, w * 0.85, w],
            pick(GREENS, rnd(seed + b) * 5),
            dt + (rnd(seed + b * 7) - 0.5) * 2
          );
      }

      // skyline: glass and concrete towers with podium, colour band, crown and spire
      const bo = 42 + rnd(seed + 23) * 68;

      if (i % 2 === 0 && !tight(200) && free(bo, 45)) {
        const tier = Math.floor(rnd(seed + 17) * 3);
        const glass = rnd(seed + 37) > 0.45;
        const bw = 16 + rnd(seed + 41) * 6;
        const height = TIERS[tier];

        add(
          `${glass ? "g" : "b"}${tier}`,
          bo,
          height / 2,
          [bw, height, bw],
          pick(glass ? GLASS : BLDG, rnd(seed + 29) * 5)
        );

        add(
          "podium",
          bo,
          2.5,
          [bw + 8, 5, bw + 8],
          pick(BLDG, rnd(seed + 31) * 5)
        ); // low base block
        add(
          "accent",
          bo,
          height * 0.82,
          [bw + 0.45, 1.5, bw + 0.45],
          pick(TEAMS, rnd(seed + 47) * 5)
        ); // colour band

        add("crowns", bo, height + 0.6, [bw + 1.2, 1.2, bw + 1.2]); // roof slab
        add("crowns", bo, height + 2.4, [bw * 0.42, 2.4, bw * 0.42]); // HVAC plant room

        if (tier === 2 && rnd(seed + 43) > 0.35) {
          add("spires", bo, height + 10, [0.45, 15, 0.45]);
        }
      }

      // TV camera towers
      if (i % 20 === 10 && free(22, 34)) {
        add("poles", 22, 9, [1.3, 18, 1.3]);
        add("rear", 22, 18.4, [5.8, 1.2, 5.8]);
        add("paddockGlass", 22, 20, [5.2, 1.8, 5.2]);
        add("paddockRoof", 22, 21.1, [6.2, 0.4, 6.2]);
        add("spires", 22, 24, [0.25, 5, 0.25]);
      }

      // Cantilever stadium floodlight towers (angled inward toward the asphalt)
      if (i % 8 === 4 && free(24, 30)) {
        add("poles", 24, 16, [0.65, 32, 0.65]);
        // Cantilever arm reaching toward track
        add("steel", 21.2, 31.8, [6.2, 0.5, 0.5], null, 0, -side * 0.18);
        // Floodlight bank hood + emissive LED array angled down at track
        add("rear", 18.5, 32.5, [2.2, 1.5, 6.4], null, 0, -side * 0.42);
        add("lamps", 18.3, 32.2, [1.8, 1.2, 6.0], null, 0, -side * 0.42);
      }
    }
  }

  // ---------- far city skyline (soft blue-grey, melts into the fog) ----------
  const FAR_COUNT = 96;
  for (let k = 0; k < FAR_COUNT; k++) {
    const a = (k / FAR_COUNT) * Math.PI * 2 + (rnd(k * 3.1) - 0.5) * 0.06;
    const rad = TRACK_R + 240 + rnd(k * 5.7) * 170;
    const w = 24 + rnd(k * 7.3) * 34;
    const h = 45 + Math.pow(rnd(k * 11.9), 2) * 135;

    g.skyline.push({
      p: [CX + rad * Math.cos(a), h / 2, CZ + rad * Math.sin(a)],
      s: [w, h, w * (0.7 + rnd(k * 2.3) * 0.6)],
      ry: a + rnd(k * 1.7),
      c: pick(FAR, rnd(k * 13.3) * 4),
    });
  }

  // ---------- pedestrian bridges over the circuit (up to 2 across the lap) ----------
  let bridgesBuilt = 0;
  for (let k = 0; k < 70 && bridgesBuilt < 2; k++) {
    const t = (0.22 + k * 0.011) % 1;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    const a = p.clone().addScaledVector(nrm, 31);
    const b = p.clone().addScaledVector(nrm, -31);

    if (farMin(a.x, a.z, t) < 42 || farMin(b.x, b.z, t) < 42) continue;

    const yaw = Math.atan2(tan.x, tan.z);
    const put = (key, x, y, z, s) => g[key].push({ p: [x, y, z], s, ry: yaw });

    // deck, rails, dual banners (both directions), and side stair towers
    put("bridge", p.x, 9.2, p.z, [62, 0.8, 4.4]);

    for (const d of [-2.1, 2.1]) {
      put("steel", p.x + tan.x * d, 10.1, p.z + tan.z * d, [62, 1.2, 0.18]);
      put(
        "bridgeBanner",
        p.x + tan.x * (d * 1.05),
        11.0,
        p.z + tan.z * (d * 1.05),
        [56, 2.5, 0.14]
      );
    }

    put("bridge", a.x, 4.8, a.z, [2.2, 9.6, 3.2]);
    put("bridge", b.x, 4.8, b.z, [2.2, 9.6, 3.2]);

    bridgesBuilt++;
    k += 28; // space second bridge well apart along the circuit
  }

  return g;
}

// ---------- distant hills (fade into the fog) ----------
function makeHills() {
  const inner = TRACK_R + 450;
  const outer = inner + 900;
  const SEG = 192;
  const RINGS = 10;

  const pos = [];
  const col = [];
  const idx = [];

  const low = new THREE.Color("#4a8940");
  const mid = new THREE.Color("#6e9678");
  const high = new THREE.Color("#a8bdd0");
  const tmp = new THREE.Color();

  for (let r = 0; r <= RINGS; r++) {
    const u = r / RINGS;
    const rad = inner + (outer - inner) * u;
    const bump = Math.pow(Math.sin(Math.PI * u), 1.3);

    for (let s = 0; s < SEG; s++) {
      const a = (s / SEG) * Math.PI * 2;

      const h = Math.max(
        0.05,
        0.55 +
          0.25 * Math.sin(3 * a + 1.3) +
          0.2 * Math.sin(7 * a + 0.4) +
          0.12 * Math.sin(13 * a + 2.1) +
          0.08 * Math.sin(29 * a)
      );

      // +1 keeps the edges just above the ground plane (no z-fighting)
      const y = 1 + 125 * h * bump * (0.9 + 0.1 * Math.sin(rad * 0.02 + a * 5));

      pos.push(CX + rad * Math.cos(a), y, CZ + rad * Math.sin(a));

      const alt = THREE.MathUtils.clamp(y / 115, 0, 1);
      if (alt < 0.5) {
        tmp.copy(low).lerp(mid, alt * 2);
      } else {
        tmp.copy(mid).lerp(high, (alt - 0.5) * 2);
      }
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }

  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < SEG; s++) {
      const a = r * SEG + s;
      const b = r * SEG + ((s + 1) % SEG);
      const c = (r + 1) * SEG + s;
      const d = (r + 1) * SEG + ((s + 1) % SEG);

      idx.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();

  return geometry;
}

// ---------- blimp & TV helicopter circling over the circuit ----------
function AerialTraffic({ altitude = 155, speed = 0.02 }) {
  const blimpRef = useRef();
  const heliRef = useRef();
  const rotorRef = useRef();
  const angle = useRef(Math.random() * Math.PI * 2);
  const radius = Math.max(140, TRACK_R * 0.8);

  const skin = useMemo(
    () =>
      tex(1024, 256, (g, w, h) => {
        g.fillStyle = "#f4f6f9";
        g.fillRect(0, 0, w, h);

        g.fillStyle = "#1e4fa3";
        g.fillRect(0, h * 0.62, w, h * 0.12);
        g.fillStyle = "#e10600";
        g.fillRect(0, h * 0.74, w, h * 0.06);

        g.fillStyle = "#e10600";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.font = "italic 900 78px Arial";
        g.fillText("APEX RACING", w * 0.25, h * 0.4);
        g.fillText("APEX RACING", w * 0.75, h * 0.4);
      }),
    []
  );

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    angle.current += dt * speed;
    const a = angle.current;

    if (blimpRef.current) {
      blimpRef.current.position.set(
        CX + Math.cos(a) * radius,
        altitude + Math.sin(a * 5) * 3,
        CZ + Math.sin(a) * radius
      );
      blimpRef.current.rotation.y = -Math.atan2(Math.cos(a), -Math.sin(a));
    }

    if (heliRef.current) {
      const ha = -a * 2.2 + 1.5;
      const hr = radius * 0.62;
      heliRef.current.position.set(
        CX + Math.cos(ha) * hr,
        altitude * 0.62 + Math.sin(ha * 4) * 2,
        CZ + Math.sin(ha) * hr
      );
      heliRef.current.rotation.y = -Math.atan2(-Math.cos(ha), Math.sin(ha));
      heliRef.current.rotation.z = -0.12; // forward pitch while flying
    }

    if (rotorRef.current) {
      rotorRef.current.rotation.y += dt * 28;
    }
  });

  return (
    <>
      {/* Blimp */}
      <group ref={blimpRef}>
        <mesh scale={[26, 8, 8]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshStandardMaterial map={skin} roughness={0.45} />
        </mesh>
        <mesh position={[-22, 0, 0]} scale={[6, 0.4, 9]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#e10600" roughness={0.5} />
        </mesh>
        <mesh position={[-22, 0, 0]} scale={[6, 9, 0.4]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#e10600" roughness={0.5} />
        </mesh>
        <mesh position={[2, -8.4, 0]} scale={[9, 2.4, 3.2]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#2a3340" roughness={0.6} />
        </mesh>
      </group>

      {/* TV Broadcast Helicopter */}
      <group ref={heliRef}>
        <mesh scale={[4.8, 2.2, 2.0]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Tail boom */}
        <mesh position={[-5.5, 0.3, 0]} scale={[6.5, 0.6, 0.6]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#e10600" roughness={0.4} />
        </mesh>
        {/* Main rotor */}
        <group ref={rotorRef} position={[0, 2.4, 0]}>
          <mesh scale={[11, 0.08, 0.45]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh scale={[0.45, 0.08, 11]}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>
      </group>
    </>
  );
}

export default function Stadium() {
  const env = useMemo(generate, []);
  const hills = useMemo(makeHills, []);

  return (
    <group>
      <mesh geometry={hills}>
        <meshStandardMaterial
          vertexColors
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>

      <AerialTraffic />

      {Object.entries(MATS).map(([k, m]) => (
        <Instanced key={k} items={env[k]} {...m} />
      ))}
    </group>
  );
}