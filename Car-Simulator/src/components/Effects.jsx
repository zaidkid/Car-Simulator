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

import { PHONE, LOW_POWER } from "./quality";

const TONE = ToneMappingMode.ACES_FILMIC ?? ToneMappingMode.NEUTRAL;

export default function Effects() {
  // Weak phones: tone mapping + a light bloom + vignette only.
  if (LOW_POWER) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={TONE} />

        <Bloom
          mipmapBlur
          levels={4}
          luminanceThreshold={1.25}
          luminanceSmoothing={0.2}
          intensity={0.18}
        />

        <Vignette offset={0.42} darkness={0.2} />
      </EffectComposer>
    );
  }

  // Normal phones and desktop.
  return (
    <EffectComposer multisampling={PHONE ? 2 : 0}>
      <ToneMapping mode={TONE} />

      <Bloom
        mipmapBlur
        levels={PHONE ? 5 : 8}
        luminanceThreshold={1.15}
        luminanceSmoothing={0.18}
        intensity={PHONE ? 0.24 : 0.32}
      />

      <HueSaturation saturation={0.08} />

      <BrightnessContrast brightness={0.01} contrast={0.045} />

      <Vignette offset={0.4} darkness={0.24} />

      {!PHONE && <SMAA />}
    </EffectComposer>
  );
}