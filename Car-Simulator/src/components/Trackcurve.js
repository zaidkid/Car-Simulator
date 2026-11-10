import * as THREE from "three";

// ~4.1 km circuit. S = straight (metres), L / R = corner (radius metres, angle degrees).
// Start/finish line is at the beginning of the first straight.
// If you edit this, the loop closes automatically (small drift is spread along the track),
// but keep the left angles minus the right angles equal to 360.
const LAYOUT = [
  ["S", 528], // start / finish straight
  ["L", 130, 90], // T1
  ["S", 286],
  ["R", 100, 50], // T2-T3 esses
  ["L", 100, 50],
  ["S", 356],
  ["L", 110, 90], // T4
  ["S", 422], // back straight
  ["L", 70, 180], // T5 hairpin
  ["S", 90],
  ["R", 70, 180], // T6 hairpin
  ["S", 382],
  ["L", 100, 90], // T7
  ["S", 264],
  ["R", 140, 40], // T8-T9 chicane
  ["L", 140, 40],
  ["S", 90],
  ["L", 120, 90], // final corner
  ["S", 140], // exit onto the grid straight
];

const STEP = 12;
const rad = Math.PI / 180;

function buildPoints() {
  const pts = [[0, 0]];
  let x = 0;
  let z = 0;
  let heading = 0;

  for (const [type, a, b] of LAYOUT) {
    const straight = type === "S";
    const arc = straight ? a : b * rad * a;
    const n = Math.max(1, Math.round(arc / STEP));
    const turn = straight ? 0 : ((type === "L" ? 1 : -1) * b * rad) / n;

    for (let i = 0; i < n; i++) {
      heading += turn / 2;
      x += (Math.cos(heading) * arc) / n;
      z += (Math.sin(heading) * arc) / n;
      heading += turn / 2;
      pts.push([x, z]);
    }
  }

  // Spread the remaining closure error evenly along the lap
  const n = pts.length - 1;
  const [ex, ez] = pts[n];

  return pts
    .slice(0, n)
    .map(([px, pz], i) => new THREE.Vector3(px - (ex * i) / n, 0, pz - (ez * i) / n));
}

export const curve = new THREE.CatmullRomCurve3(buildPoints(), true, "centripetal");

// Long loop: sample the arc-length table finely so getPointAt stays accurate
curve.arcLengthDivisions = 8000;
curve.updateArcLengths();