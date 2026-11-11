import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

import { game } from "./gameStore";
import { START, track, trackNormals, WALL_OFFSET, carContact } from "./Race";
import { telemetry, grid } from "./Telemetry";
import { prepareCarModel } from "./CarModel";

const F1_CAR_URL = "/models/Red_bull_car.glb";
const G = 9.81;
const SPARK_COUNT = 6;

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
  // Softer launch: limits low-speed acceleration without reducing top speed.
  traction: 12,
  downforceTraction: 0.0012,
  drag: 0.0012,
  drsDragCut: 0.28,
  rolling: 0.25,
  engineBrake: 3.2,

  brakeLow: 26,
  brakePeak: 52,

  reverseSpeed: 20,
  reverseAccel: 9,

  // ---- cornering / steering ----
  roadGrip: 7, // how quickly sideways sliding is killed
  gripPerSpeed: 0.05, // extra grip with speed
  lateralBase: 24, // sideways acceleration available at low speed, m/s^2
  downforceLat: 0.0085, // extra sideways acceleration from downforce
  maxYawLow: 2.2, // maximum turn rate at low speed, rad/s

  steerRate: 8, // how fast the wheel turns toward the input
  steerReturn: 11, // how fast the wheel returns to centre
  steerSpeedFade: 80, // steering ramp slows only slightly with speed

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
// MAIN CAR COMPONENT
// ==========================================

export default function Car({ carRef, mobileRef, hudRef, paused = false }) {
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

  const engine = useRef(null);
  const horn = useRef(null);
  const crashAudio = useRef(null);
  const skid = useRef(null);

  const lastCrash = useRef(0);
  const lastWall = useRef(0);
  const previousPhase = useRef("ready");
  const lastSpeed = useRef(-1);
  const lastContactId = useRef(carContact.id);

  const collisionState = useRef({
    timer: 0,
    duration: 1,
    spin: 0,
  });

  // Spark pool: a fixed set of meshes that is re-used, so a crash never
  // causes a React re-render (important for smoothness on phones).
  const sparkMeshes = useRef([]);
  const sparkState = useRef(
    Array.from({ length: SPARK_COUNT }, () => ({ age: 1, scale: 1 })),
  );
  const sparkNext = useRef(0);

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
    audioRetry: 0,
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

    if (skid.current) {
      skid.current.gain.gain.value = 0;
    }

    // Synchronize with Race.jsx.
    track.resetToken = (track.resetToken || 0) + 1;
  }, [carRef]);

  // ==========================================
  // PAUSE SUPPORT
  // ==========================================

  useEffect(() => {
    if (!paused) return;

    // Clear held inputs so the car cannot accelerate or steer on resume.
    keys.current = {};
    if (mobileRef?.current) {
      Object.keys(mobileRef.current).forEach((key) => {
        mobileRef.current[key] = false;
      });
    }

    Object.assign(ctl.current, {
      throttle: 0,
      brake: 0,
      steer: 0,
      skidGain: 0,
    });

    if (engine.current) {
      engine.current.pause();
    }

    if (skid.current) {
      skid.current.gain.gain.value = 0;
      if (skid.current.engineGain) skid.current.engineGain.gain.value = 0;
    }
  }, [paused, mobileRef]);

  // ==========================================
  // CRASH SPARKS + IMPACT RESPONSE
  // ==========================================

  const addSparks = (strength = 1) => {
    const p = carRef.current?.translation();

    if (p && strength > 0.12) {
      const i = sparkNext.current++ % SPARK_COUNT;
      const mesh = sparkMeshes.current[i];
      const st = sparkState.current[i];

      if (mesh) {
        mesh.position.set(p.x, p.y + 0.4, p.z);
        mesh.visible = true;
      }

      st.age = 0;
      st.scale = 0.7 + strength * 0.9;
    }

    if (crashAudio.current) {
      crashAudio.current.currentTime = 0;
      crashAudio.current.volume = THREE.MathUtils.clamp(
        0.25 + strength * 0.75,
        0,
        1,
      );
      crashAudio.current.play().catch(() => {});
    }
  };

  // strength 0..1, spin in rad/s (sign = direction the car is knocked round)
  const registerImpact = (strength, spin) => {
    const s = THREE.MathUtils.clamp(strength, 0, 1);
    const c = collisionState.current;

    c.duration = 0.25 + s * 0.9;
    c.timer = c.duration;
    c.spin = spin;

    if (s > 0.2) game.crash();

    addSparks(s);

    // Android phones: a short buzz on a hit (iOS ignores this)
    if (s > 0.3) {
      try {
        navigator.vibrate?.(Math.round(20 + s * 60));
      } catch {
        /* not supported */
      }
    }
  };

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
  // AUDIO
  // ==========================================

  useEffect(() => {
    engine.current = new Audio("/sounds/engine.mp3");
    engine.current.loop = true;
    engine.current.preload = "auto";
    engine.current.volume = 0.4;

    engine.current.preservesPitch = false;
    engine.current.mozPreservesPitch = false;
    engine.current.webkitPreservesPitch = false;

    horn.current = new Audio("/sounds/honk.mp3");
    crashAudio.current = new Audio("/sounds/crash.mp3");

    return () => {
      [engine.current, horn.current, crashAudio.current].forEach((audio) => {
        if (!audio) return;

        audio.pause();
        audio.src = "";
      });
    };
  }, []);

  // ==========================================
  // TYRE SQUEAL + ENGINE VOLUME NODE
  // Created on the first tap / key press (browsers require a gesture).
  // The engine loop is routed through a gain node: it keeps running and only
  // its volume changes, so there is no stop/start stutter and volume control
  // also works on iPhones (where audio.volume is ignored).
  // ==========================================

  useEffect(() => {
    const start = () => {
      if (skid.current) return;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;

      if (!AudioCtx) return;

      const ctx = new AudioCtx();

      if (ctx.resume) ctx.resume().catch(() => {});

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

      let engineGain = null;
      const eng = engine.current;

      if (eng) {
        try {
          const node = ctx.createMediaElementSource(eng);
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          node.connect(engineGain);
          engineGain.connect(ctx.destination);
          eng.volume = 1;
          eng.play().catch(() => {});
        } catch {
          engineGain = null;
        }
      }

      skid.current = {
        ctx,
        gain,
        filter,
        engineGain,
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
  // COLLISIONS WITH THE ENVIRONMENT
  // (car-to-car contact is handled in Race.jsx and arrives through
  //  carContact, so it can be resolved smoothly instead of as a hard stop)
  // ==========================================

  const onCollision = (event) => {
    const otherName = event.other.rigidBodyObject?.name || "";

    const isEnvironment = ["building", "traffic", "barrier"].includes(
      otherName,
    );

    if (!isEnvironment) return;

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

    registerImpact(
      THREE.MathUtils.clamp(impactSpeed / 50, 0.2, 1),
      spinDirection * THREE.MathUtils.clamp(impactSpeed / 75, 0.12, 0.48),
    );
  };

  // ==========================================
  // MAIN PHYSICS LOOP
  // ==========================================

  useFrame((state, delta) => {
    // Physics is paused by the parent Physics component. Stop the
    // car controller and audio updates as well until the race resumes.
    if (paused) return;

    const body = carRef.current;

    if (!body) return;

    const dt = Math.min(delta, 0.04);

    if (dt <= 0) return;

    // ---- spark pool ----
    for (let i = 0; i < SPARK_COUNT; i++) {
      const st = sparkState.current[i];

      if (st.age >= 0.35) continue;

      st.age += dt;

      const mesh = sparkMeshes.current[i];

      if (!mesh) continue;

      if (st.age >= 0.35) {
        mesh.visible = false;
      } else {
        mesh.scale.setScalar((1 + st.age * 3) * st.scale);
        mesh.material.opacity = Math.max(0, 1 - st.age / 0.35);
      }
    }

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

    // ---- contact with another car (resolved in Race.jsx) ----
    if (carContact.id !== lastContactId.current) {
      lastContactId.current = carContact.id;

      const now = performance.now();

      if (active && now - lastCrash.current > 250) {
        lastCrash.current = now;
        registerImpact(carContact.strength, carContact.spin);
      }
    }

    collision.timer = Math.max(0, collision.timer - dt);

    const collisionBlend = THREE.MathUtils.smoothstep(
      collision.timer,
      0,
      collision.duration,
    );

    // ==========================================
    // INPUT
    // ==========================================

    const k = keys.current;
    const m = mobileRef?.current || {};

    const throttleIn = canDrive && (k.w || k.arrowup || m.forward) ? 1 : 0;

    const brakeIn = canDrive && (k.s || k.arrowdown || m.backward) ? 1 : 0;

    const left = k.a || k.arrowleft || m.left;

    const right = k.d || k.arrowright || m.right;

    const digitalSteer = (left ? 1 : 0) - (right ? 1 : 0);

    // Touch steering wheel writes m.steer (-1 left .. +1 right, analog).
    // It wins over the digital left/right flags while it is not zero.
    const analogSteer =
      typeof m.steer === "number" && m.steer !== 0 ? -m.steer : 0;

    const steerInput = canDrive
      ? THREE.MathUtils.clamp(analogSteer !== 0 ? analogSteer : digitalSteer, -1, 1)
      : 0;

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
      throttleIn > c.throttle ? 4 : 14,
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
    // Reaches full lock quickly at every speed; swinging from one side
    // to the other is even faster (counter-steer). Works with analog input.
    // ==========================================

    const steerBase = steerInput === 0 ? CAR.steerReturn : CAR.steerRate;

    const counterSteer =
      steerInput !== 0 &&
      Math.sign(steerInput) !== Math.sign(c.steer) &&
      c.steer !== 0
        ? 1.5
        : 1;

    const steerRate = (steerBase * counterSteer) / (1 + v / CAR.steerSpeedFade);

    c.steer = approach(c.steer, steerInput, steerRate, dt);

    const aLatMax = (CAR.lateralBase + CAR.downforceLat * v * v) * surf.grip;

    const yawCap = Math.min(CAR.maxYawLow, aLatMax / Math.max(v, 1));

    const lowSpeed = THREE.MathUtils.clamp(
      Math.abs(nextForwardSpeed) / 4,
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
          addSparks(THREE.MathUtils.clamp(outward / 30, 0.25, 1));
        }
      }

      const push = Math.abs(offset) - wallLimit;

      body.setTranslation(
        {
          x: carPosition.x - n.x * side * push,
          y: carPosition.y,
          z: carPosition.z - n.z * side * push,
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

    // Clamped so the sharper steering never shows silly numbers on the HUD
    c.latG = THREE.MathUtils.damp(
      c.latG,
      THREE.MathUtils.clamp((steeringRate * nextForwardSpeed) / G, -6, 6),
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
    // ENGINE AUDIO — PLAYER CAR ONLY
    // The loop keeps playing while the car is drivable; only its volume
    // follows the throttle (smoothly, via c.throttle), so lifting off never
    // stops and restarts the sound.
    // ==========================================

    const audio = engine.current;

    if (audio) {
      const gainNode = skid.current?.engineGain;
      const level = canDrive ? 0.1 + 0.3 * c.throttle : 0;

      const actualSpeed = Math.hypot(current.x, current.z);
      const speedNorm = THREE.MathUtils.clamp(
        actualSpeed / CAR.gearTops[7],
        0,
        1,
      );

      c.audioPitch = THREE.MathUtils.damp(
        c.audioPitch,
        canDrive ? speedNorm : 0,
        5,
        dt,
      );

      const rate = 0.75 + c.audioPitch * 1.15;

      if (Math.abs(audio.playbackRate - rate) > 0.01) {
        audio.playbackRate = rate;
      }

      if (gainNode) {
        gainNode.gain.value = level;

        if (audio.paused && canDrive) {
          c.audioRetry -= dt;

          if (c.audioRetry <= 0) {
            c.audioRetry = 0.5;
            audio.play().catch(() => {});
          }
        }
      } else if (level > 0.05) {
        // Fallback when Web Audio is unavailable
        audio.volume = Math.min(1, level);

        if (audio.paused) {
          audio.play().catch(() => {});
        }
      } else if (!audio.paused) {
        audio.pause();
      }
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
    // TELEMETRY (written field by field: no object allocated per frame)
    // ==========================================

    telemetry.speed = speed;
    telemetry.kmh = Math.round(speed * 3.6);
    telemetry.gear =
      forwardSpeed < -0.5 ? -1 : v < 0.8 && c.throttle < 0.05 ? 0 : c.gear;

    telemetry.rpm = c.rpm;
    telemetry.idleRpm = CAR.idleRpm;
    telemetry.maxRpm = CAR.maxRpm;

    telemetry.throttle = c.throttle;
    telemetry.brake = c.brake;
    telemetry.steer = c.steer;

    telemetry.latG = c.latG;
    telemetry.longG = c.longG;

    telemetry.battery = c.battery;

    telemetry.ers = !!ersOn;
    telemetry.drs = !!drsOn;

    telemetry.surface = surfaceName;

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

      {/* Spark pool (re-used, never mounted/unmounted) */}
      {Array.from({ length: SPARK_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            sparkMeshes.current[i] = mesh;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshBasicMaterial
            color="#ffb000"
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

useGLTF.preload(F1_CAR_URL);