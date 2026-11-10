import { useThree, useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { telemetry } from "./telemetry";

// Press C to cycle: cockpit -> T-cam (airbox) -> chase
const MODES = ["cockpit", "tcam", "chase"];
const UP = new THREE.Vector3(0, 1, 0);

export default function FollowCamera({ targetRef }) {
  const { camera, gl } = useThree();

  const mode = useRef("cockpit");

  const yaw = useRef(null);
  const lookYaw = useRef(0);
  const pitch = useRef(0.22);
  const distance = useRef(12);
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

    const onDown = (event) => {
      if (mode.current !== "chase" || event.button !== 0) return;

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
      if (!dragging.current || mode.current !== "chase") return;

      lookYaw.current -= event.movementX * 0.004;

      pitch.current = THREE.MathUtils.clamp(
        pitch.current + event.movementY * 0.003,
        0.06,
        0.85
      );
    };

    const onWheel = (event) => {
      if (mode.current !== "chase") return;

      event.preventDefault();

      distance.current = THREE.MathUtils.clamp(
        distance.current + event.deltaY * 0.008,
        5,
        20
      );
    };

    const onKeyDown = (event) => {
      if (event.key.toLowerCase() === "c" && !event.repeat) {
        const next =
          (MODES.indexOf(mode.current) + 1) % MODES.length;

        mode.current = MODES[next];
        telemetry.camera = mode.current;

        lookYaw.current = 0;
        yaw.current = null;
      }
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

    let wantedFov = 72;

    if (mode.current === "cockpit" || mode.current === "tcam") {
      const isCockpit = mode.current === "cockpit";

      // Cockpit: driver's eyes behind the halo. T-cam: above the airbox.
      const baseX = 0;
      const baseY = isCockpit ? 1.08 : 1.58;
      const baseZ = isCockpit ? -0.18 : -0.9;

      localOffset.current
        .set(
          baseX + lean.current.x + shakeX,
          baseY + lean.current.y + shakeY,
          baseZ + lean.current.z
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

      wantedFov =
        (isCockpit ? 72 : 68) +
        speedRatio * 12 +
        (telemetry.ers ? 3 : 0) +
        (telemetry.drs ? 2 : 0);
    } else {
      // THIRD-PERSON CHASE CAMERA.

      const heading = Math.atan2(
        forward.current.x,
        forward.current.z
      );

      if (!dragging.current) {
        lookYaw.current *= Math.exp(-2.8 * dt);
      }

      const wantedYaw =
        heading + Math.PI + lookYaw.current;

      if (yaw.current === null) {
        yaw.current = wantedYaw;
      }

      let difference = wantedYaw - yaw.current;

      difference = Math.atan2(
        Math.sin(difference),
        Math.cos(difference)
      );

      yaw.current +=
        difference * (1 - Math.exp(-6 * dt));

      target.current.y = p.y + 1.45;

      const horizontal = Math.cos(pitch.current);

      // The camera pulls back a little at high speed.
      const chaseDistance = distance.current + speedRatio * 2.5;

      desired.current
        .set(
          Math.sin(yaw.current) * horizontal,
          Math.sin(pitch.current),
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
        .addScaledVector(forward.current, 7);

      camera.up.set(0, 1, 0);
      camera.lookAt(lookAt.current);

      wantedFov =
        65 +
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
    camera.far = 2500;

    camera.updateProjectionMatrix();
  });

  return null;
}