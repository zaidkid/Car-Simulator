import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
  ChromaticAberration,
  HueSaturation,
  BrightnessContrast,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import * as THREE from "three";

import { telemetry } from "./Telemetry";

// Put <Effects /> inside <Canvas>, after the scene content.
export default function Effects() {
  const chroma = useRef();
  const vignette = useRef();

  const chromaOffset = useMemo(
    () => new THREE.Vector2(0.0004, 0.0004),
    []
  );

  // Speed makes the edges of the screen softer and darker.
  useFrame(() => {
    const speed = Math.min(telemetry.speed / 95, 1);
    const boost = telemetry.ers ? 0.0004 : 0;
    const amount = 0.0004 + speed * speed * 0.0011 + boost;

    if (chroma.current) {
      chroma.current.offset.set(amount, amount);
    }

    if (vignette.current) {
      vignette.current.darkness = 0.45 + speed * 0.3;
    }
  });

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.55}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
        mipmapBlur
      />

      <ChromaticAberration ref={chroma} offset={chromaOffset} />

      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

      <HueSaturation saturation={0.08} />
      <BrightnessContrast contrast={0.08} />

      <Vignette ref={vignette} offset={0.3} darkness={0.5} />
    </EffectComposer>
  );
}