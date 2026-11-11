import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";

export const IS_MOBILE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const MAX_DPR =
  typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
const MIN_DPR = 1;

// Put <Quality /> inside <Canvas>.
// Starts at full sharpness (up to 2x) and lowers/raises the render resolution on its own,
// so the game stays sharp when the phone can handle it and smooth when it can't.
export default function Quality() {
  const setDpr = useThree((state) => state.setDpr);
  const dpr = useRef(MAX_DPR);

  useEffect(() => {
    setDpr(MAX_DPR);
  }, [setDpr]);

  const step = (amount) => {
    dpr.current = THREE.MathUtils.clamp(dpr.current + amount, MIN_DPR, MAX_DPR);
    setDpr(dpr.current);
  };

  return (
    <PerformanceMonitor
      ms={250}
      iterations={6}
      flipflops={4}
      onDecline={() => step(-0.25)}
      onIncline={() => step(0.25)}
    />
  );
}