import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { curve } from "./TrackCurve";

// APEX RACING - F1 trackside environment v4
// Follows ./TrackCurve, so nothing overlaps other sections of the circuit.
// New in v4: glass + concrete skyscrapers with crowns and spires, team-coloured
// grandstand sections with fascia boards, flags, animated-look big screens,
// a pedestrian bridge over the circuit, a glazed paddock building and a ring of
// distant hills that fades into the fog.

const TRACK_OFFSET = 34; // distance from the centre line to the ad wall area
const BASE = 3; // grandstands start this far beyond TRACK_OFFSET
const TILT = 0.13;

const L = curve.getLength();
const SEGMENTS = Math.round(L / 24);
const LEN = (L / SEGMENTS) * 1.03;

// Clearance check: distance to the nearest part of the track that is NOT nearby
// along the lap, so nothing is built on top of another section of the circuit
const N = 800;
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

const rnd = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const pick = (arr, n) => arr[Math.floor(n) % arr.length];

const SEAT = ["#2b3a52", "#3a4a63", "#1f2b3d", "#c9d1db"];
const BLDG = ["#f2f4f7", "#e3e8ee", "#ffffff", "#d5dde6"];
const GLASS = ["#ffffff", "#dbe8f5", "#c9dcef", "#eef4fa"];
const GREENS = ["#2f6b34", "#3a7a3a", "#285c30", "#4a8540"];
const GRASS = ["#3f7d3a", "#478a3f"];
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
  t.anisotropy = 8;
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

      // soft diagonal accent
      g.fillStyle = "rgba(255,255,255,0.12)";
      g.beginPath();
      g.moveTo(x + 180, 0);
      g.lineTo(x + 256, 0);
      g.lineTo(x + 226, h);
      g.lineTo(x + 150, h);
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
      g.fillText(name, x + 128, h / 2 - 6);

      g.fillStyle = "#e10600";
      g.fillRect(x, h - 12, 256, 12);
    });
  });

  t.repeat.x = flip ? -repeat : repeat;
  if (flip) t.offset.x = repeat;
  return t;
};

const crowdTex = tex(2048, 128, (g, w, h) => {
  g.fillStyle = "#1b2433";
  g.fillRect(0, 0, w, h);
  const shirts = ["#d9d9d9", "#b32b35", "#1f3a6e", "#e0b84d", "#2a2f38", "#8a99ad", "#19a59b", "#ff8700"];
  const skins = ["#f1c9a5", "#c68e63", "#8d5a3b", "#e8b896"];
  for (let x = 6; x < w; x += 18 + Math.random() * 10) {
    if (Math.random() < 0.12) continue;
    const y = h - 58 - Math.random() * 14;
    g.fillStyle = shirts[Math.floor(Math.random() * shirts.length)];
    g.fillRect(x, y + 20, 18, 60);
    g.fillStyle = skins[Math.floor(Math.random() * skins.length)];
    g.beginPath();
    g.arc(x + 9, y + 10, 8, 0, Math.PI * 2);
    g.fill();
    if (Math.random() < 0.2) g.fillRect(x + 16, y + 4, 4, 22); // raised arm
  }
});

const netTex = tex(64, 64, (g, w, h) => {
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#fff";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(w, h);
  g.moveTo(w, 0); g.lineTo(0, h);
  g.stroke();
});
netTex.repeat.set(LEN / 1.2, 5 / 1.2);

// Big screen content
const screenTex = tex(512, 256, (g, w, h) => {
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#0a1b45");
  grad.addColorStop(1, "#1a3d91");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.fillStyle = "#e10600";
  g.fillRect(0, 0, w, 16);
  g.fillRect(0, h - 16, w, 16);

  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "italic 900 74px Arial";
  g.fillText("APEX RACING", w / 2, h / 2 - 22);
  g.font = "700 30px Arial";
  g.fillStyle = "#9fc2ff";
  g.fillText("WORLD CHAMPIONSHIP  ·  LIVE", w / 2, h / 2 + 46);
});

// Building facades: 4 columns x 4 floors per tile
const facadeBase = {
  glass: tex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#a9c8e2");
    grad.addColorStop(1, "#6a90b0");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const lit = Math.random() < 0.07;
        g.fillStyle = lit
          ? "#f6e7b0"
          : `rgba(${20 + Math.random() * 25},${50 + Math.random() * 30},${85 + Math.random() * 35},0.55)`;
        g.fillRect(c * 64 + 3, r * 64 + 3, 58, 58);
      }
    }

    g.strokeStyle = "#2b3d50";
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0); g.lineTo(i * 64, h);
      g.moveTo(0, i * 64); g.lineTo(w, i * 64);
      g.stroke();
    }
  }),

  concrete: tex(256, 256, (g, w, h) => {
    g.fillStyle = "#e6e9ee";
    g.fillRect(0, 0, w, h);

    for (let r = 0; r < 4; r++) {
      const y = r * 64;

      g.fillStyle = "#d3d9e0"; // floor slab
      g.fillRect(0, y, w, 22);

      for (let c = 0; c < 4; c++) {
        const lit = Math.random() < 0.1;
        g.fillStyle = lit ? "#f3e2a6" : "#41566e";
        g.fillRect(c * 64 + 4, y + 24, 56, 34);
      }

      g.fillStyle = "#c7ced6";
      for (let c = 0; c <= 4; c++) g.fillRect(c * 64 - 2, y + 22, 4, 40);
    }
  }),
};

const facadeTex = (style, h) => {
  const t = facadeBase[style].clone();
  t.needsUpdate = true;
  t.repeat.set(3, h / 14);
  return t;
};

// ---------- instancing ----------
const GEOS = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
};

function Instanced({ items, geo = "box", color = "#fff", ...mat }) {
  const ref = useRef();

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m || !items.length) return;
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    d.rotation.order = "YXZ";
    items.forEach((it, i) => {
      d.position.set(...it.p);
      d.rotation.set(0, it.ry || 0, it.rz || 0);
      d.scale.set(...it.s);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      m.setColorAt(i, c.set(it.c || color));
    });
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, color]);

  if (!items.length) return null;

  return (
    <instancedMesh
      ref={ref}
      key={items.length}
      args={[GEOS[geo], undefined, items.length]}
      frustumCulled={false}
      receiveShadow
    >
      <meshStandardMaterial {...mat} />
    </instancedMesh>
  );
}

const MATS = {
  grass: { color: "#3f7d3a", roughness: 1 },
  adsP: { map: adTex(false), roughness: 0.35 },
  adsN: { map: adTex(true), roughness: 0.35 },
  net: { color: "#222", alphaMap: netTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 },
  fpost: { geo: "cyl", color: "#2b333d", metalness: 0.7, roughness: 0.4 },
  seats: { roughness: 0.8 },
  crowd: { map: crowdTex, roughness: 1 },
  rear: { color: "#2a3340" },
  posts: { geo: "cyl", color: "#dfe4ea", metalness: 0.6, roughness: 0.4 },
  steel: { color: "#aab4c0", metalness: 0.6, roughness: 0.4 },
  roof: { color: "#f3f5f7", emissive: "#2a2d33", roughness: 0.6, side: THREE.DoubleSide },
  roofUnder: { color: "#9aa4b0", roughness: 0.8 },
  fascia: { roughness: 0.45 },
  flagpoles: { geo: "cyl", color: "#e8ecf1", metalness: 0.6, roughness: 0.4 },
  flags: { roughness: 0.8, side: THREE.DoubleSide },
  paddock: { color: "#dfe5ec", roughness: 0.7 },
  paddockGlass: { color: "#1d2f45", metalness: 0.6, roughness: 0.15 },
  paddockRoof: { color: "#c7cfd8", roughness: 0.6 },
  garage: { roughness: 0.5 },
  bridge: { color: "#e6ebf0", metalness: 0.4, roughness: 0.45 },
  bridgeBanner: { map: adTex(false, 6), roughness: 0.4 },
  trunks: { geo: "cyl", color: "#4a3524", roughness: 1 },
  leaves: { geo: "ico", roughness: 1 },
  b0: { map: facadeTex("concrete", TIERS[0]), roughness: 0.65 },
  b1: { map: facadeTex("concrete", TIERS[1]), roughness: 0.65 },
  b2: { map: facadeTex("concrete", TIERS[2]), roughness: 0.65 },
  g0: { map: facadeTex("glass", TIERS[0]), metalness: 0.35, roughness: 0.28 },
  g1: { map: facadeTex("glass", TIERS[1]), metalness: 0.35, roughness: 0.28 },
  g2: { map: facadeTex("glass", TIERS[2]), metalness: 0.35, roughness: 0.28 },
  crowns: { color: "#4b5561", roughness: 0.8 },
  spires: { geo: "cyl", color: "#cfd6de", metalness: 0.7, roughness: 0.3 },
  poles: { geo: "cyl", color: "#e0e5eb", metalness: 0.7 },
  lamps: { color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 2 },
  screens: {
    map: screenTex,
    emissiveMap: screenTex,
    emissive: "#ffffff",
    emissiveIntensity: 0.9,
    roughness: 0.4,
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

    for (const side of [-1, 1]) {
      const seed = i * 31 + side * 7;
      const inner = side === Math.sign(kn);
      const tight = (r) => inner && Math.abs(kn) > 1 / r;

      const free = (o, r) => {
        const p = point.clone().addScaledVector(normal, side * (TRACK_OFFSET + o));
        return farMin(p.x, p.z, t) > r;
      };

      const add = (k, o, h, s, c, dt = 0, rz = 0) => {
        const p = point.clone().addScaledVector(normal, side * (TRACK_OFFSET + o)).addScaledVector(tan, dt);
        g[k].push({ p: [p.x, h, p.z], s, ry: yaw, rz, c });
      };

      // verge, ad wall behind the barrier, catch fence (posts lean inward)
      add("grass", 11, 0.04, [38, 0.08, LEN], pick(GRASS, i));
      add(side > 0 ? "adsP" : "adsN", -5, 1.1, [0.4, 2.2, LEN]);
      add("net", -2, 3.5, [0.05, 5, LEN]);
      if (i % 2 === 0) add("fpost", -2, 3, [0.18, 6.2, 0.18], null, 0, side * 0.08);

      // paddock + garages along the start / finish straight (one side)
      const paddock = isMain && side > 0 && free(14, 42);

      if (paddock) {
        add("paddock", 14, 4, [12, 8, LEN]);
        add("garage", 7.8, 1.8, [0.3, 3, LEN * 0.7], pick(TEAMS, i));
        add("paddockGlass", 7.9, 5.9, [0.15, 2.2, LEN * 0.96]); // upper-floor hospitality glazing
        add("paddockRoof", 11.2, 8.15, [15, 0.3, LEN]); // overhanging roof
      }

      // grandstand: more rows on the main straight, never on a tight inside corner
      const rows = isMain ? 11 : 8;
      const stand =
        wantStand && !(isMain && side > 0) && !tight(140) && free(BASE + rows * 0.8, 32 + rows * 0.8);

      if (stand) {
        const width = rows * 1.6;
        const oEnd = BASE + width;
        const top = 1.2 + (rows - 1) * 0.8;
        const roofH = 5.2 + rows * 0.8;

        // some sections are painted in a team colour
        const section = i % 7 === 0 ? pick(TEAMS, i >> 1) : null;

        for (let r = 0; r < rows; r++) {
          const o = BASE + 0.8 + r * 1.6;
          const h = 1.2 + r * 0.8;
          add("seats", o, h / 2, [1.6, h, LEN], section || pick(SEAT, r + (i >> 1)));
          add("crowd", o - 0.1, h + 0.45, [1.0, 0.9, LEN]);
        }

        add("rear", oEnd + 0.4, (top + 3) / 2, [0.8, top + 3, LEN]);
        add("posts", oEnd + 0.6, (roofH - 1) / 2, [1, roofH - 1, 1], null, LEN / 2);
        add("posts", BASE - 1, (roofH - 1) / 2, [0.35, roofH - 1, 0.35]);

        // team-coloured fascia board along the front of the roof
        add("fascia", BASE - 1.2, roofH - 1.3, [0.3, 1.0, LEN * 0.98], pick(TEAMS, i >> 2));

        // white gabled canopy + underside + ridge beam
        const span = width + 2;
        const q = span / 4;
        const o0 = BASE + width / 2;
        const drop = q * Math.tan(TILT);

        for (const [dx, sg] of [[-q, -1], [q, 1]]) {
          add("roof", o0 + dx, roofH - drop, [span / 2 + 0.2, 0.2, LEN * 0.98], null, 0, sg * side * TILT);
          add("roofUnder", o0 + dx, roofH - drop - 0.18, [span / 2, 0.08, LEN * 0.96], null, 0, sg * side * TILT);
        }
        add("steel", o0, roofH + 0.1, [0.4, 0.4, LEN]);

        if (isMain ? i % 6 === 3 : i % 18 === 3) add("screens", oEnd, roofH - 3.5, [0.5, 4, 9]);
      }

      // team flags between the ad wall and the fence
      if (i % 3 === 0 && (stand || isMain)) {
        add("flagpoles", -3, 3.5, [0.12, 7, 0.12]);
        add("flags", -3, 6.1, [0.04, 1.5, 2.8], pick(TEAMS, i + side + 3), 1.4);
      }

      // trees: trunk + 3 leaf blobs
      const to = stand || paddock ? 26 + rnd(seed + 5) * 10 : 8 + rnd(seed + 5) * 14;

      if (rnd(seed + 3) > 0.4 && free(to, 32)) {
        const dt = (rnd(seed + 11) - 0.5) * LEN;
        const w = 3.5 + rnd(seed + 9) * 2;

        add("trunks", to, 2, [0.5, 4, 0.5], null, dt);
        for (let b = 0; b < 3; b++)
          add(
            "leaves",
            to + (rnd(seed + b * 3) - 0.5) * 2,
            5 + rnd(seed + b * 5) * 1.5,
            [w, w * 0.85, w],
            pick(GREENS, rnd(seed + b) * 4),
            dt + (rnd(seed + b * 7) - 0.5) * 2
          );
      }

      // skyline: glass and concrete towers with crowns and spires
      const bo = 40 + rnd(seed + 23) * 70;

      if (i % 2 === 0 && !tight(200) && free(bo, 45)) {
        const tier = Math.floor(rnd(seed + 17) * 3);
        const glass = rnd(seed + 37) > 0.5;
        const bw = 16 + rnd(seed + 41) * 5;
        const height = TIERS[tier];

        add(
          `${glass ? "g" : "b"}${tier}`,
          bo,
          height / 2,
          [bw, height, bw],
          pick(glass ? GLASS : BLDG, rnd(seed + 29) * 4)
        );

        add("crowns", bo, height + 0.6, [bw + 1.2, 1.2, bw + 1.2]); // roof slab
        add("crowns", bo, height + 2.4, [bw * 0.4, 2.4, bw * 0.4]); // plant room

        if (tier === 2 && rnd(seed + 43) > 0.35) {
          add("spires", bo, height + 10, [0.5, 15, 0.5]);
        }
      }

      // floodlight towers
      if (i % 8 === 4 && free(24, 30)) {
        add("poles", 24, 17, [0.7, 34, 0.7]);
        add("lamps", 24, 34, [6, 1.2, 2]);
      }
    }
  }

  // ---------- pedestrian bridge over the circuit ----------
  for (let k = 0; k < 60; k++) {
    const t = 0.25 + k * 0.01;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    const a = p.clone().addScaledVector(nrm, 31);
    const b = p.clone().addScaledVector(nrm, -31);

    if (farMin(a.x, a.z, t) < 40 || farMin(b.x, b.z, t) < 40) continue;

    const yaw = Math.atan2(tan.x, tan.z);

    const put = (key, x, y, z, s) => g[key].push({ p: [x, y, z], s, ry: yaw });

    // deck, rails, banner, and a support on each side
    put("bridge", p.x, 9, p.z, [62, 0.7, 4]);

    for (const d of [-1.95, 1.95]) {
      put("steel", p.x + tan.x * d, 9.9, p.z + tan.z * d, [62, 1.1, 0.15]);
    }

    put("bridgeBanner", p.x - tan.x * 2, 10.9, p.z - tan.z * 2, [56, 2.4, 0.12]);

    put("bridge", a.x, 4.5, a.z, [1.2, 9, 1.6]);
    put("bridge", b.x, 4.5, b.z, [1.2, 9, 1.6]);

    break;
  }

  return g;
}

// ---------- distant hills (fade into the fog) ----------
function makeHills() {
  let cx = 0;
  let cz = 0;
  trackPts.forEach((p) => {
    cx += p.x;
    cz += p.z;
  });
  cx /= N;
  cz /= N;

  let R = 0;
  trackPts.forEach((p) => {
    R = Math.max(R, Math.hypot(p.x - cx, p.z - cz));
  });

  const inner = R + 450;
  const outer = inner + 900;
  const SEG = 192;
  const RINGS = 10;

  const pos = [];
  const col = [];
  const idx = [];

  const low = new THREE.Color("#456f3f");
  const high = new THREE.Color("#8e9d92");
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
      const y = 1 + 120 * h * bump * (0.9 + 0.1 * Math.sin(rad * 0.02 + a * 5));

      pos.push(cx + rad * Math.cos(a), y, cz + rad * Math.sin(a));

      tmp.copy(low).lerp(high, THREE.MathUtils.clamp(y / 110, 0, 1));
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

export default function Stadium() {
  const env = useMemo(generate, []);
  const hills = useMemo(makeHills, []);

  return (
    <group>
      <mesh geometry={hills}>
        <meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} />
      </mesh>

      {Object.entries(MATS).map(([k, m]) => (
        <Instanced key={k} items={env[k]} {...m} />
      ))}
    </group>
  );
}