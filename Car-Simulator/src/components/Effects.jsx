import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
  HueSaturation,
  BrightnessContrast,
  SMAA,
} from "@react-three/postprocessing";

import { ToneMappingMode } from "postprocessing";

const PHONE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

export default function Effects() {
  return (
    <EffectComposer multisampling={PHONE ? 2 : 0}>
      <ToneMapping
        mode={
          ToneMappingMode.ACES_FILMIC ??
          ToneMappingMode.NEUTRAL
        }
      />

      <Bloom
        mipmapBlur
        luminanceThreshold={1.15}
        luminanceSmoothing={0.18}
        intensity={0.32}
      />

      <HueSaturation saturation={0.08} />

      <BrightnessContrast
        brightness={0.015}
        contrast={0.045}
      />

      <Vignette
        offset={0.38}
        darkness={0.28}
      />

      {!PHONE && <SMAA />}
    </EffectComposer>
  );
}