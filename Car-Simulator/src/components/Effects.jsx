import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

import { PHONE, LOW_POWER } from "./Device";

export default function Effects({ night = false }) {
  // Weak phones skip post-processing; App.jsx turns on canvas antialiasing for them instead.
  if (LOW_POWER) return null;

  const toneMode = ToneMappingMode.ACES_FILMIC ?? ToneMappingMode.NEUTRAL;

  // multisampling = edge smoothing (the canvas antialias setting does not apply when
  // post-processing is on, which is why edges looked jagged before).
  if (PHONE) {
    return (
      <EffectComposer multisampling={2}>
        <ToneMapping mode={toneMode} />
        <Bloom
          mipmapBlur
          luminanceThreshold={night ? 0.95 : 1.45}
          luminanceSmoothing={0.2}
          intensity={night ? 0.24 : 0.12}
        />
        <Vignette offset={0.46} darkness={0.13} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={4}>
      <ToneMapping mode={toneMode} />
      <Bloom
        mipmapBlur
        luminanceThreshold={night ? 0.82 : 1.25}
        luminanceSmoothing={night ? 0.24 : 0.18}
        intensity={night ? 0.48 : 0.2}
      />
      <Vignette offset={0.44} darkness={0.17} />
    </EffectComposer>
  );
}
