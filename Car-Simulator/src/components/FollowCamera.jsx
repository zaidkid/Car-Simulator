import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { telemetry } from "./Telemetry";
import { IS_MOBILE } from "./Quality";

// Camera views. Press C to cycle, or 1-8 to pick one (telemetry.camera holds the name).
// first = eye position relative to the car (x right, y up, z forward): driver-style views.
// dist / pitch / y / ahead / turn = third-person views (distance, angle, height, look-ahead, swing speed).
const VIEWS = {
  cockpit: { first: [0, 1.08, -0.18], fov: 72 }, // driver's eyes behind the halo
  hood: { first: [0, 0.9, 1.3], fov: 78 }, // nose camera
  tcam: { first: [0, 1.58, -0.9], fov: 68 }, // above the airbox
  chase: { dist: 12, pitch: 0.22, fov: 65, y: 1.45, ahead: 7, turn: 6 },
  far: { dist: 20, pitch: 0.3, fov: 60, y: 1.45, ahead: 9, turn: 4 },
  low: { dist: 6.5, pitch: 0.07, fov: 72, y: 0.9, ahead: 10, turn: 8 },
  top: { dist: 40, pitch: 1.35, fov: 50, y: 0.5, ahead: 6, turn: 2.5 },
  orbit: { dist: 11, pitch: 0.2, fov: 55, y: 1.2, ahead: 0, turn: 4, orbit: true },
};

const MODES = Object.keys(VIEWS);
const UP = new THREE.Vector3(0, 1, 0);

export default function FollowCamera({ targetRef }) {
  const { camera, gl } = useThree();

  const mode = useRef("cockpit");

  const yaw = useRef(null);
  const lookYaw = useRef(0);
  const pitchAdjust = useRef(0); // mouse-drag tilt, added to the view's own angle
  const distanceAdjust = useRef(0); // mouse-wheel zoom, added to the view's own distance
  const dragging = useRef(false);

  const fov = useRef(72);
  const time = useRef(0);
  const lean = useRef(new THREE.Vector3());

  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const lookDir = useRef(new THREE.Vector3());
  const quaternion = useRef(new THREE.Quaternion());
  const localOffset = useRef(new THREE.Vector3());

  useEffect(() => {
    const element = gl.domElement;

    const isThirdPerson = () => !VIEWS[mode.current].first;

    const setMode = (name) => {
      mode.current = name;
      telemetry.camera = name;

      lookYaw.current = 0;
      pitchAdjust.current = 0;
      distanceAdjust.current = 0;
      yaw.current = null;
    };

    const onDown = (event) => {
      if (!isThirdPerson() || event.button !== 0) return;

      dragging.current = true;
      element.setPointerCapture?.(event.pointerId);
    };

    const onUp = (event) => {
      dragging.current = false;

      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    };

    const onMove = (event) => {
      if (!dragging.current || !isThirdPerson()) return;

      lookYaw.current -= event.movementX * 0.004;
      pitchAdjust.current += event.movementY * 0.003;
    };

    const onWheel = (event) => {
      if (!isThirdPerson()) return;

      event.preventDefault();

      distanceAdjust.current = THREE.MathUtils.clamp(
        distanceAdjust.current + event.deltaY * 0.008,
        -6,
        12
      );
    };

    const onKeyDown = (event) => {
      if (event.repeat) return;

      const key = event.key.toLowerCase();

      if (key === "c") {
        setMode(MODES[(MODES.indexOf(mode.current) + 1) % MODES.length]);
      }

      const n = Number(key);
      if (n >= 1 && n <= MODES.length) setMode(MODES[n - 1]);
    };

    telemetry.camera = mode.current;

    element.addEventListener("pointerdown", onDown);
    element.addEventListener("pointerup", onUp);
    element.addEventListener("pointercancel", onUp);
    element.addEventListener("pointermove", onMove);
    element.addEventListener("wheel", onWheel, {
      passive: false,
    });

    window.addEventListener("keydown", onKeyDown);

    return () => {
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("pointerup", onUp);
      element.removeEventListener("pointercancel", onUp);
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("wheel", onWheel);

      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const body = targetRef.current;

    if (!body) return;

    const dt = Math.min(delta, 0.05);
    time.current += dt;

    const t = time.current;
    const view = VIEWS[mode.current];
    const speedRatio = THREE.MathUtils.clamp(
      telemetry.speed / 95,
      0,
      1
    );

    const p = body.translation();
    const r = body.rotation();

    quaternion.current.set(r.x, r.y, r.z, r.w);

    // Car forward direction: local +Z.
    forward.current
      .set(0, 0, 1)
      .applyQuaternion(quaternion.current)
      .normalize();

    target.current.set(p.x, p.y, p.z);

    // ----------------------------------
    // Head movement from G-forces
    // ----------------------------------
    // Cornering pushes the head sideways, braking pushes it forward.
    lean.current.x = THREE.MathUtils.damp(
      lean.current.x,
      -telemetry.latG * 0.012,
      6,
      dt
    );

    lean.current.y = THREE.MathUtils.damp(
      lean.current.y,
      Math.min(0, telemetry.longG) * 0.004,
      6,
      dt
    );

    lean.current.z = THREE.MathUtils.damp(
      lean.current.z,
      -telemetry.longG * 0.01,
      6,
      dt
    );

    // ----------------------------------
    // Vibration: grows with speed, spikes on kerbs and gravel
    // ----------------------------------
    const amplitude =
      0.0015 +
      speedRatio * speedRatio * 0.006 +
      telemetry.kerbShake * 0.02;

    const shakeX =
      (Math.sin(t * 47) + Math.sin(t * 31.7 + 1.3)) * 0.5 * amplitude;

    const shakeY =
      (Math.sin(t * 53.3 + 0.7) + Math.sin(t * 37.1)) *
      0.5 *
      amplitude *
      1.4;

    let wantedFov = view.fov;

    if (view.first) {
      // DRIVER-STYLE VIEWS (cockpit, hood, T-cam).
      localOffset.current
        .set(
          view.first[0] + lean.current.x + shakeX,
          view.first[1] + lean.current.y + shakeY,
          view.first[2] + lean.current.z
        )
        .applyQuaternion(quaternion.current);

      desired.current.copy(target.current).add(localOffset.current);

      // The driver looks slightly into the corner.
      lookDir.current
        .copy(forward.current)
        .applyAxisAngle(UP, telemetry.steer * 0.1);

      lookAt.current
        .copy(desired.current)
        .addScaledVector(lookDir.current, 35);

      camera.position.copy(desired.current);
      camera.up.set(0, 1, 0);
      camera.lookAt(lookAt.current);

      // Lean with the car in corners.
      camera.rotateZ(-telemetry.latG * 0.004);

      wantedFov +=
        speedRatio * 12 +
        (telemetry.ers ? 3 : 0) +
        (telemetry.drs ? 2 : 0);
    } else {
      // THIRD-PERSON VIEWS (chase, far, low rear, top, orbit).
      const heading = Math.atan2(
        forward.current.x,
        forward.current.z
      );

      if (!dragging.current) {
        lookYaw.current *= Math.exp(-2.8 * dt);
      }

      // Orbit circles the car; every other view stays behind it.
      const wantedYaw = view.orbit
        ? t * 0.4 + lookYaw.current
        : heading + Math.PI + lookYaw.current;

      if (yaw.current === null) {
        yaw.current = wantedYaw;
      }

      let difference = wantedYaw - yaw.current;

      difference = Math.atan2(
        Math.sin(difference),
        Math.cos(difference)
      );

      yaw.current +=
        difference * (1 - Math.exp(-view.turn * dt));

      target.current.y = p.y + view.y;

      const pitch = THREE.MathUtils.clamp(
        view.pitch + pitchAdjust.current,
        0.05,
        1.45
      );

      const horizontal = Math.cos(pitch);

      // The camera pulls back a little at high speed.
      const chaseDistance =
        THREE.MathUtils.clamp(view.dist + distanceAdjust.current, 4, 50) +
        speedRatio * 2.5;

      desired.current
        .set(
          Math.sin(yaw.current) * horizontal,
          Math.sin(pitch),
          Math.cos(yaw.current) * horizontal
        )
        .multiplyScalar(chaseDistance)
        .add(target.current);

      desired.current.y = Math.max(0.8, desired.current.y);

      camera.position.lerp(
        desired.current,
        1 - Math.exp(-9 * dt)
      );

      camera.position.x += shakeX * 0.6;
      camera.position.y += shakeY * 0.6;

      lookAt.current
        .copy(target.current)
        .addScaledVector(forward.current, view.ahead);

      camera.up.set(0, 1, 0);
      camera.lookAt(lookAt.current);

      wantedFov +=
        speedRatio * 14 +
        (telemetry.ers ? 3 : 0) +
        (telemetry.drs ? 2 : 0);
    }

    // Smooth field-of-view change = sense of speed.
    fov.current = THREE.MathUtils.damp(
      fov.current,
      wantedFov,
      4,
      dt
    );

    camera.fov = fov.current;

    // A larger near plane keeps the flat track layers from z-fighting.
    camera.near = 0.2;
    camera.far = IS_MOBILE ? 1400 : 2500; // shorter range on phones = faster, fewer depth glitches

    camera.updateProjectionMatrix();
  });

  return null;
}