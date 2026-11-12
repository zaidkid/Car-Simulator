import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

import { PHONE, LOW_POWER } from "./Device";

export default function Effects() {
  // Weak phones skip post-processing; App.jsx turns on canvas antialiasing for them instead.
  if (LOW_POWER) return null;

  const toneMode = ToneMappingMode.ACES_FILMIC ?? ToneMappingMode.NEUTRAL;

  // multisampling = edge smoothing (the canvas antialias setting does not apply when
  // post-processing is on, which is why edges looked jagged before).
  if (PHONE) {
    return (
      <EffectComposer multisampling={2}>
        <ToneMapping mode={toneMode} />
        <Vignette offset={0.46} darkness={0.13} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={4}>
      <ToneMapping mode={toneMode} />
      <Bloom mipmapBlur luminanceThreshold={1.25} luminanceSmoothing={0.18} intensity={0.2} />
      <Vignette offset={0.44} darkness={0.17} />
    </EffectComposer>
  );
}