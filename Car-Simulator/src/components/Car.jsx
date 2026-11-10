import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

import { game } from "./gameStore";
import { START, track, trackNormals, WALL_OFFSET } from "./Race";
import { telemetry, grid } from "./Telemetry";
import { prepareCarModel } from "./CarModel";

const F1_CAR_URL = "/models/Red_bull_car.glb";
const G = 9.81;

// ==========================================
// F1 CAR TUNING
// All speeds in metres/second
// ==========================================

const CAR = {
  gearTops: [24, 36, 47, 58, 68, 77, 85, 93],
  idleRpm: 4200,
  maxRpm: 12500,

  power: 1400,
  ersPower: 150,
  traction: 28,
  downforceTraction: 0.0016,
  drag: 0.0012,
  drsDragCut: 0.28,
  rolling: 0.25,
  engineBrake: 3.2,

  brakeLow: 26,
  brakePeak: 52,

  reverseSpeed: 20,
  reverseAccel: 9,

  roadGrip: 5.5,
  gripPerSpeed: 0.035,
  lateralBase: 14,
  downforceLat: 0.0054,
  maxYawLow: 1.6,

  ersDrain: 7,
  ersRecharge: 3,
  ersBrakeRecharge: 12,
};

const SURFACE = {
  track: {
    speed: 1,
    grip: 1,
    accel: 1,
    extraDrag: 0,
    overDecel: 6,
  },

  kerb: {
    speed: 1,
    grip: 0.92,
    accel: 1,
    extraDrag: 0,
    overDecel: 6,
  },

  runoff: {
    speed: 0.62,
    grip: 0.7,
    accel: 0.7,
    extraDrag: 4,
    overDecel: 12,
  },

  gravel: {
    speed: 0.28,
    grip: 0.38,
    accel: 0.35,
    extraDrag: 16,
    overDecel: 25,
  },
};

const approach = (value, target, rate, dt) =>
  value < target
    ? Math.min(target, value + rate * dt)
    : Math.max(target, value - rate * dt);

// ==========================================
// CAR LIVERY
// ==========================================

const recolorLivery = (m) => {
  const hsl = {};
  m.color?.getHSL(hsl);

  if (m.color && hsl.h > 0.38 && hsl.h < 0.62 && hsl.s > 0.18) {
    m.color.set("#c90024");
    m.metalness = 0.55;
    m.roughness = 0.28;
  }
};

// ==========================================
// SPARK EFFECT
// ==========================================

function SparkBurst({ position, onDone }) {
  const ref = useRef();
  const age = useRef(0);

  useFrame((_, delta) => {
    age.current += delta;

    if (ref.current) {
      ref.current.scale.setScalar(1 + age.current * 3);
      ref.current.material.opacity = Math.max(0, 1 - age.current / 0.35);
    }

    if (age.current > 0.35) onDone();
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.12, 8, 8]} />
      <meshBasicMaterial
        color="#ffb000"
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ==========================================
// MAIN CAR COMPONENT
// ==========================================

export default function Car({ carRef, mobileRef, hudRef }) {
  const gltf = useGLTF(F1_CAR_URL);
  const modelRef = useRef();

  const model = useMemo(
    () => prepareCarModel(gltf.scene, recolorLivery),
    [gltf.scene],
  );

  const { actions } = useAnimations(gltf.animations, modelRef);

  useEffect(() => {
    const wheelAnimation = Object.entries(actions).find(([name]) =>
      /wheel.*roll|roll.*wheel/i.test(name),
    )?.[1];

    wheelAnimation?.reset().play();

    return () => wheelAnimation?.stop();
  }, [actions]);

  const keys = useRef({});
  const [sparks, setSparks] = useState([]);

  const engine = useRef(null); // synthesized engine: { ctx, master, filter, oscs }
  const horn = useRef(null);
  const crashAudio = useRef(null);
  const skid = useRef(null);

  const lastCrash = useRef(0);
  const lastWall = useRef(0);
  const previousPhase = useRef("ready");
  const lastSpeed = useRef(-1);

  const collisionState = useRef({
    timer: 0,
    spin: 0,
  });

  // ==========================================
  // DRIVING STATE
  // ==========================================

  const ctl = useRef({
    throttle: 0,
    brake: 0,
    steer: 0,
    gear: 1,
    rpm: CAR.idleRpm,
    shiftTimer: 0,
    reverseTimer: 0,
    battery: 100,
    longG: 0,
    latG: 0,
    skidGain: 0,
    audioPitch: 0,
  });

  const forward = useRef(new THREE.Vector3());
  const velocity = useRef(new THREE.Vector3());
  const lateral = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Quaternion());

  // ==========================================
  // RESET CAR
  // ==========================================

  const resetCar = useCallback(() => {
    const body = carRef.current;

    if (!body) return;

    body.setTranslation(
      {
        x: START.pos[0],
        y: START.pos[1],
        z: START.pos[2],
      },
      true,
    );

    body.setRotation(
      {
        x: 0,
        y: Math.sin(START.yaw / 2),
        z: 0,
        w: Math.cos(START.yaw / 2),
      },
      true,
    );

    body.setLinvel({ x: 0, y: 0, z: 0 }, true);

    body.setAngvel({ x: 0, y: 0, z: 0 }, true);

    Object.assign(ctl.current, {
      battery: 100,
      gear: 1,
      rpm: CAR.idleRpm,
      throttle: 0,
      brake: 0,
      steer: 0,
      shiftTimer: 0,
      reverseTimer: 0,
      longG: 0,
      latG: 0,
      skidGain: 0,
      audioPitch: 0,
    });

    collisionState.current.timer = 0;
    collisionState.current.spin = 0;

    keys.current = {};

    telemetry.speed = 0;
    telemetry.kmh = 0;
    telemetry.gear = 1;
    telemetry.rpm = CAR.idleRpm;
    telemetry.throttle = 0;
    telemetry.brake = 0;
    telemetry.steer = 0;
    telemetry.latG = 0;
    telemetry.longG = 0;
    telemetry.kerbShake = 0;
    telemetry.ers = false;
    telemetry.drs = false;

    if (engine.current) engine.current.master.gain.value = 0;

    if (skid.current) {
      skid.current.gain.gain.value = 0;
    }

    // Synchronize with Race.jsx.
    track.resetToken = (track.resetToken || 0) + 1;
  }, [carRef]);

  // ==========================================
  // KEYBOARD INPUT
  // ==========================================

  useEffect(() => {
    const prevent = new Set([
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      " ",
    ]);

    const onDown = (event) => {
      const key = event.key.toLowerCase();

      if (prevent.has(key)) event.preventDefault();

      keys.current[key] = true;

      if (event.repeat) return;

      if (key === "r") resetCar();

      if (key === "h" && horn.current) {
        horn.current.currentTime = 0;
        horn.current.play().catch(() => {});
      }
    };

    const onUp = (event) => {
      keys.current[event.key.toLowerCase()] = false;
    };

    const clear = () => {
      keys.current = {};
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
    };
  }, [resetCar]);

  // ==========================================
  // AUDIO (horn + crash samples)
  // ==========================================

  useEffect(() => {
    horn.current = new Audio("/sounds/honk.mp3");
    crashAudio.current = new Audio("/sounds/crash.mp3");

    return () => {
      [horn.current, crashAudio.current].forEach((audio) => {
        if (!audio) return;

        audio.pause();
        audio.src = "";
      });
    };
  }, []);

  // ==========================================
  // SYNTHESIZED ENGINE (starts on first tap / key press)
  // ==========================================

  useEffect(() => {
    const start = () => {
      if (engine.current) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      ctx.resume?.();

      const master = ctx.createGain();
      master.gain.value = 0;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 800;
      filter.Q.value = 1.5;

      // [wave, harmonic multiple, level]
      const oscs = [
        ["sawtooth", 1, 0.5],
        ["sawtooth", 1.005, 0.5],
        ["square", 2, 0.15],
        ["sawtooth", 0.5, 0.3],
      ].map(([type, mult, level]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        g.gain.value = level;
        o.connect(g);
        g.connect(filter);
        o.start();
        return { o, mult };
      });

      filter.connect(master);
      master.connect(ctx.destination);

      engine.current = { ctx, master, filter, oscs };
    };

    window.addEventListener("keydown", start, { once: true });
    window.addEventListener("pointerdown", start, { once: true });

    return () => {
      window.removeEventListener("keydown", start);
      window.removeEventListener("pointerdown", start);

      engine.current?.ctx.close().catch(() => {});
      engine.current = null;
    };
  }, []);

  // ==========================================
  // TYRE SQUEAL
  // ==========================================

  useEffect(() => {
    const start = () => {
      if (skid.current) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;

      if (!AudioCtx) return;

      const ctx = new AudioCtx();

      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);

      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1500;
      filter.Q.value = 4;

      const gain = ctx.createGain();
      gain.gain.value = 0;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start();

      skid.current = {
        ctx,
        gain,
        filter,
      };
    };

    window.addEventListener("keydown", start, { once: true });
    window.addEventListener("pointerdown", start, { once: true });

    return () => {
      window.removeEventListener("keydown", start);
      window.removeEventListener("pointerdown", start);

      skid.current?.ctx.close().catch(() => {});
      skid.current = null;
    };
  }, []);

  // ==========================================
  // CRASH SPARKS
  // ==========================================

  const addSparks = (now) => {
    const p = carRef.current?.translation();

    if (p) {
      setSparks((items) => [
        ...items,
        {
          id: now,
          position: [p.x, p.y + 0.4, p.z],
        },
      ]);
    }

    if (crashAudio.current) {
      crashAudio.current.currentTime = 0;
      crashAudio.current.play().catch(() => {});
    }
  };

  // ==========================================
  // COLLISIONS
  // ==========================================

  const onCollision = (event) => {
    const otherName = event.other.rigidBodyObject?.name || "";

    const isAI = otherName.startsWith("ai-car-");

    const isEnvironment = ["building", "traffic", "barrier"].includes(
      otherName,
    );

    if (!isAI && !isEnvironment) return;

    const now = performance.now();

    if (now - lastCrash.current < 650) return;

    lastCrash.current = now;

    const playerBody = carRef.current;
    const otherBody = event.other.rigidBody;

    const playerPosition = playerBody?.translation();
    const otherPosition = otherBody?.translation();

    let spinDirection = Math.random() > 0.5 ? 1 : -1;

    if (playerPosition && otherPosition && playerBody) {
      const q = playerBody.rotation();

      const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(
        new THREE.Quaternion(q.x, q.y, q.z, q.w),
      );

      const dx = otherPosition.x - playerPosition.x;
      const dz = otherPosition.z - playerPosition.z;

      spinDirection = dx * rightVector.x + dz * rightVector.z >= 0 ? -1 : 1;
    }

    const impactVelocity = playerBody?.linvel();

    const impactSpeed = impactVelocity
      ? Math.hypot(impactVelocity.x, impactVelocity.z)
      : 0;

    collisionState.current.timer = 1.15;

    collisionState.current.spin =
      spinDirection * THREE.MathUtils.clamp(impactSpeed / 75, 0.12, 0.48);

    game.crash();
    addSparks(now);
  };

  // ==========================================
  // MAIN PHYSICS LOOP
  // ==========================================

  useFrame((state, delta) => {
    const body = carRef.current;

    if (!body) return;

    const dt = Math.min(delta, 0.04);

    if (dt <= 0) return;

    const phase = game.get().phase;

    if (phase === "playing" && previousPhase.current !== "playing") {
      resetCar();
    }

    previousPhase.current = phase;

    const active = phase === "playing";

    // ==========================================
    // EMERGENCY FALL RECOVERY
    // ==========================================

    const carPosition = body.translation();

    if (carPosition.y < -1.5) {
      console.warn("APEX RACING: Car fell below the circuit. Recovering...");

      resetCar();

      collisionState.current.timer = 0;
      collisionState.current.spin = 0;

      return;
    }

    // ==========================================
    // START LIGHT CONTROL
    // ==========================================

    const canDrive = active && grid.go;

    const c = ctl.current;

    const collision = collisionState.current;

    collision.timer = Math.max(0, collision.timer - dt);

    const collisionBlend = THREE.MathUtils.smoothstep(collision.timer, 0, 1.15);

    // ==========================================
    // INPUT
    // ==========================================

    const k = keys.current;
    const m = mobileRef?.current || {};

    const throttleIn = canDrive && (k.w || k.arrowup || m.forward) ? 1 : 0;

    const brakeIn = canDrive && (k.s || k.arrowdown || m.backward) ? 1 : 0;

    const left = k.a || k.arrowleft || m.left;

    const right = k.d || k.arrowright || m.right;

    const steerInput = canDrive ? (left ? 1 : 0) - (right ? 1 : 0) : 0;

    // ==========================================
    // CURRENT MOTION
    // ==========================================

    const q = body.rotation();

    rotation.current.set(q.x, q.y, q.z, q.w);

    forward.current.set(0, 0, 1).applyQuaternion(rotation.current).normalize();

    const current = body.linvel();

    velocity.current.set(current.x, 0, current.z);

    const forwardSpeed = velocity.current.dot(forward.current);

    lateral.current
      .copy(velocity.current)
      .addScaledVector(forward.current, -forwardSpeed);

    const lateralSpeed = lateral.current.length();

    const v = Math.max(0, forwardSpeed);

    const surfaceName = track.surface || "track";

    const surf = SURFACE[surfaceName] || SURFACE.track;

    // ==========================================
    // PEDALS
    // ==========================================

    c.throttle = approach(
      c.throttle,
      throttleIn,
      throttleIn > c.throttle ? 6 : 14,
      dt,
    );

    const brakingForward = brakeIn && forwardSpeed > 0.8;

    c.brake = approach(
      c.brake,
      brakingForward ? 1 : 0,
      brakingForward ? 7 : 16,
      dt,
    );

    if (brakeIn && Math.abs(forwardSpeed) < 0.8) {
      c.reverseTimer += dt;
    } else if (!brakeIn) {
      c.reverseTimer = 0;
    }

    const reversing = brakeIn && forwardSpeed <= 0.8 && c.reverseTimer > 0.3;

    // ==========================================
    // GEARBOX
    // ==========================================

    const tops = CAR.gearTops;

    c.shiftTimer = Math.max(0, c.shiftTimer - dt);

    if (forwardSpeed >= -0.5) {
      while (c.gear < 8 && v > tops[c.gear - 1] * 0.965) {
        c.gear += 1;
        c.shiftTimer = 0.08;
      }

      while (c.gear > 1 && v < tops[c.gear - 2] * 0.86) {
        c.gear -= 1;
      }
    }

    // ==========================================
    // ERS AND DRS
    // ==========================================

    const ersOn =
      canDrive && (k.shift || m.ers) && throttleIn && c.battery > 0.5 && v > 5;

    const drsOn =
      canDrive &&
      track.drsAllowed &&
      (k.e || m.drs) &&
      throttleIn &&
      !brakeIn &&
      v > 40;

    if (ersOn) {
      c.battery = Math.max(0, c.battery - CAR.ersDrain * dt);
    } else {
      c.battery = Math.min(
        100,
        c.battery + (CAR.ersRecharge + c.brake * CAR.ersBrakeRecharge) * dt,
      );
    }

    // ==========================================
    // LONGITUDINAL ACCELERATION
    // ==========================================

    let acc = 0;

    if (reversing) {
      acc = -CAR.reverseAccel;
    } else if (forwardSpeed < -0.8) {
      acc = throttleIn ? CAR.brakeLow : 4;
    } else if (brakeIn && forwardSpeed < 0.8) {
      acc = -forwardSpeed * 8;
    } else {
      const power = CAR.power + (ersOn ? CAR.ersPower : 0);

      const tractionLimit =
        (CAR.traction + CAR.downforceTraction * v * v) * surf.grip;

      const thrust =
        Math.min(tractionLimit, power / Math.max(v, 6)) *
        c.throttle *
        (c.shiftTimer > 0 ? 0.35 : 1) *
        surf.accel;

      const drag = CAR.drag * (drsOn ? 1 - CAR.drsDragCut : 1) * v * v;

      const brakeDecel =
        (CAR.brakeLow +
          (CAR.brakePeak - CAR.brakeLow) *
            THREE.MathUtils.clamp(v / 70, 0, 1)) *
        surf.grip *
        c.brake;

      const surfaceDrag = surf.extraDrag * Math.min(1, v / 20);

      acc =
        thrust -
        drag -
        CAR.rolling -
        brakeDecel -
        surfaceDrag -
        (c.throttle < 0.05 ? CAR.engineBrake : 0);
    }

    let nextForwardSpeed = forwardSpeed + acc * dt;

    if (forwardSpeed >= 0 && nextForwardSpeed < 0 && !reversing) {
      nextForwardSpeed = 0;
    }

    // ==========================================
    // SPEED LIMITER
    // ==========================================

    const speedLimit = CAR.gearTops[7] + (drsOn ? 3.5 : 0) + (ersOn ? 2 : 0);

    const adjustedSpeedLimit = speedLimit * surf.speed;

    if (nextForwardSpeed > adjustedSpeedLimit) {
      nextForwardSpeed = Math.max(
        adjustedSpeedLimit,
        forwardSpeed - surf.overDecel * dt,
      );
    }

    nextForwardSpeed = Math.max(nextForwardSpeed, -CAR.reverseSpeed);

    nextForwardSpeed *= Math.exp(-1.2 * collisionBlend * dt);

    // ==========================================
    // LATERAL GRIP
    // ==========================================

    const gripRate = (CAR.roadGrip + v * CAR.gripPerSpeed) * surf.grip;

    lateral.current.multiplyScalar(Math.exp(-gripRate * dt));

    velocity.current
      .copy(forward.current)
      .multiplyScalar(nextForwardSpeed)
      .add(lateral.current);

    // ==========================================
    // STEERING
    // ==========================================

    const steerRate = (steerInput === 0 ? 8 : 5.5) / (1 + v / 30);

    c.steer = approach(c.steer, steerInput, steerRate, dt);

    const aLatMax = (CAR.lateralBase + CAR.downforceLat * v * v) * surf.grip;

    const yawCap = Math.min(CAR.maxYawLow, aLatMax / Math.max(v, 1));

    const lowSpeed = THREE.MathUtils.clamp(
      Math.abs(nextForwardSpeed) / 5,
      0.12,
      1,
    );

    const steeringRate =
      c.steer * yawCap * lowSpeed * (nextForwardSpeed >= 0 ? 1 : -1);

    const collisionSpin = collision.spin * collisionBlend;

    // ==========================================
    // TRACK WALL
    // ==========================================

    const offset = track.offset || 0;

    const wallLimit = WALL_OFFSET - 1.15;

    if (active && Math.abs(offset) > wallLimit && trackNormals[track.index]) {
      const side = Math.sign(offset);

      const n = trackNormals[track.index];

      const outward =
        (velocity.current.x * n.x + velocity.current.z * n.z) * side;

      if (outward > 0) {
        velocity.current.x -= n.x * side * outward * 1.35;

        velocity.current.z -= n.z * side * outward * 1.35;

        velocity.current.multiplyScalar(0.8);

        const now = performance.now();

        if (now - lastWall.current > 700) {
          lastWall.current = now;

          game.crash();
          addSparks(now);
        }
      }

      const p = body.translation();

      const push = Math.abs(offset) - wallLimit;

      body.setTranslation(
        {
          x: p.x - n.x * side * push,
          y: p.y,
          z: p.z - n.z * side * push,
        },
        true,
      );
    }

    // ==========================================
    // APPLY PHYSICS
    // ==========================================

    body.setLinvel(
      {
        x: velocity.current.x,
        y: current.y,
        z: velocity.current.z,
      },
      true,
    );

    body.setAngvel(
      {
        x: 0,
        y: steeringRate + collisionSpin,
        z: 0,
      },
      true,
    );

    // ==========================================
    // RPM
    // ==========================================

    let targetRpm;

    if (forwardSpeed < -0.5) {
      targetRpm =
        CAR.idleRpm + Math.min(1, -forwardSpeed / CAR.reverseSpeed) * 3500;
    } else {
      const fraction = THREE.MathUtils.clamp(v / tops[c.gear - 1], 0, 1);

      targetRpm = CAR.idleRpm + fraction * (CAR.maxRpm - CAR.idleRpm);

      if (c.gear === 1 && v < 6) {
        targetRpm = Math.max(
          targetRpm,
          CAR.idleRpm + c.throttle * 5500 * (1 - v / 6),
        );
      }
    }

    c.rpm = THREE.MathUtils.damp(c.rpm, targetRpm, 16, dt);

    // ==========================================
    // G-FORCES AND BODY MOTION
    // ==========================================

    const longG = THREE.MathUtils.clamp(
      (nextForwardSpeed - forwardSpeed) / dt / G,
      -6,
      4,
    );

    c.longG = THREE.MathUtils.damp(c.longG, longG, 10, dt);

    c.latG = THREE.MathUtils.damp(
      c.latG,
      (steeringRate * nextForwardSpeed) / G,
      10,
      dt,
    );

    const speed = Math.abs(nextForwardSpeed);

    const speedRatio = THREE.MathUtils.clamp(speed / 95, 0, 1);

    const offTrack = ["kerb", "runoff", "gravel"].includes(surfaceName);

    const shakeTarget =
      (surfaceName === "kerb" ? 1 : offTrack ? 0.5 : 0) *
      THREE.MathUtils.clamp(speed / 60, 0, 1);

    telemetry.kerbShake = THREE.MathUtils.damp(
      telemetry.kerbShake,
      shakeTarget,
      12,
      dt,
    );

    // ==========================================
    // VISUAL BODY MOVEMENT
    // ==========================================

    const visual = modelRef.current;

    if (visual) {
      visual.rotation.z = THREE.MathUtils.damp(
        visual.rotation.z,
        c.latG * 0.0045,
        8,
        dt,
      );

      visual.rotation.x = THREE.MathUtils.damp(
        visual.rotation.x,
        -c.longG * 0.0045,
        8,
        dt,
      );

      visual.position.y =
        Math.sin(state.clock.elapsedTime * 70) *
        0.004 *
        speedRatio *
        (1 + telemetry.kerbShake * 3);
    }

    // ==========================================
    // ENGINE AUDIO (silent at standstill, pitch follows speed)
    // ==========================================

    const eng = engine.current;

    if (eng) {
      if (eng.ctx.state === "suspended") eng.ctx.resume?.();

      // 0..1 from standstill to top speed; small rev only when launching
      const speedNorm = THREE.MathUtils.clamp(speed / CAR.gearTops[7], 0, 1);
      const launchRev = v < 6 ? c.throttle * 0.12 * (1 - v / 6) : 0;

      // Rises with speed, falls when you lift off or brake; never jumps
      c.audioPitch = THREE.MathUtils.damp(
        c.audioPitch || 0,
        speedNorm + launchRev,
        throttleIn ? 3 : 1.5,
        dt,
      );

      // Silent when stopped with no throttle, and silent outside the race
      const moving = THREE.MathUtils.clamp(speed / 2, 0, 1);
      const level = canDrive
        ? Math.max(moving * (0.35 + 0.65 * c.throttle), c.throttle * 0.45)
        : 0;

      const t = eng.ctx.currentTime;
      const f = 70 + c.audioPitch * 330;

      eng.oscs.forEach(({ o, mult }) =>
        o.frequency.setTargetAtTime(f * mult, t, 0.05),
      );
      eng.filter.frequency.setTargetAtTime(
        500 + c.audioPitch * 2500 + c.throttle * 600,
        t,
        0.08,
      );
      eng.master.gain.setTargetAtTime(level * 0.12, t, 0.08);
    }

    // ==========================================
    // TYRE SQUEAL
    // ==========================================

    const skidNode = skid.current;

    if (skidNode) {
      const cornering = THREE.MathUtils.clamp((lateralSpeed - 7) / 10, 0, 1);

      const lockUp =
        c.brake > 0.9 && v > 35
          ? THREE.MathUtils.clamp((v - 35) / 50, 0.2, 0.6)
          : 0;

      const target = Math.max(cornering, lockUp) * 0.06;

      c.skidGain = THREE.MathUtils.damp(c.skidGain, target, 14, dt);

      skidNode.gain.gain.value = c.skidGain;

      skidNode.filter.frequency.value = 1200 + cornering * 900;
    }

    // ==========================================
    // TELEMETRY
    // ==========================================

    Object.assign(telemetry, {
      speed,
      kmh: Math.round(speed * 3.6),
      gear:
        forwardSpeed < -0.5 ? -1 : v < 0.8 && c.throttle < 0.05 ? 0 : c.gear,

      rpm: c.rpm,
      idleRpm: CAR.idleRpm,
      maxRpm: CAR.maxRpm,

      throttle: c.throttle,
      brake: c.brake,
      steer: c.steer,

      latG: c.latG,
      longG: c.longG,

      battery: c.battery,

      ers: !!ersOn,
      drs: !!drsOn,

      surface: surfaceName,
    });

    // ==========================================
    // SPEEDOMETER
    // ==========================================

    if (hudRef?.current && telemetry.kmh !== lastSpeed.current) {
      lastSpeed.current = telemetry.kmh;

      hudRef.current.textContent = `${telemetry.kmh} km/h`;
    }
  });

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <>
      <RigidBody
        ref={carRef}
        name="player-car"
        colliders={false}
        position={START.pos}
        rotation={[0, START.yaw, 0]}
        canSleep={false}
        ccd
        linearDamping={0}
        angularDamping={0.8}
        enabledRotations={[false, true, false]}
        onCollisionEnter={onCollision}
      >
        <CuboidCollider
          args={[1.03, 0.42, 2.7]}
          friction={0}
          frictionCombineRule={1}
          restitution={0.02}
        />

        <group ref={modelRef}>
          <primitive object={model} />
        </group>
      </RigidBody>

      {sparks.map((spark) => (
        <SparkBurst
          key={spark.id}
          position={spark.position}
          onDone={() =>
            setSparks((items) => items.filter((item) => item.id !== spark.id))
          }
        />
      ))}
    </>
  );
}

useGLTF.preload(F1_CAR_URL);