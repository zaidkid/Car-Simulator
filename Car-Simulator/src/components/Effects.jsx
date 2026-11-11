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

const LOW_POWER =
  PHONE &&
  typeof navigator !== "undefined" &&
  (
    (navigator.deviceMemory || 4) <= 4 ||
    (navigator.hardwareConcurrency || 4) <= 4
  );

export default function Effects() {
  if (LOW_POWER) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping
          mode={
            ToneMappingMode.ACES_FILMIC ??
            ToneMappingMode.NEUTRAL
          }
        />

        <Bloom
          mipmapBlur
          luminanceThreshold={1.25}
          luminanceSmoothing={0.2}
          intensity={0.18}
        />

        <Vignette
          offset={0.42}
          darkness={0.2}
        />
      </EffectComposer>
    );
  }

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
        intensity={PHONE ? 0.24 : 0.32}
      />

      <HueSaturation saturation={0.08} />

      <BrightnessContrast
        brightness={0.01}
        contrast={0.045}
      />

      <Vignette
        offset={0.4}
        darkness={0.24}
      />

      {!PHONE && <SMAA />}
    </EffectComposer>
  );
}