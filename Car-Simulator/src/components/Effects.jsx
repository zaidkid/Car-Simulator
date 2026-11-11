import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

const PHONE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
const LOW_POWER =
  PHONE &&
  typeof navigator !== "undefined" &&
  ((navigator.deviceMemory || 4) <= 4 || (navigator.hardwareConcurrency || 4) <= 4);

export default function Effects() {
  // Keep low-memory phones on the direct render path.
  if (LOW_POWER) return null;

  const toneMode = ToneMappingMode.ACES_FILMIC ?? ToneMappingMode.NEUTRAL;

  if (PHONE) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping mode={toneMode} />
        <Vignette offset={0.46} darkness={0.13} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={toneMode} />
      <Bloom mipmapBlur luminanceThreshold={1.25} luminanceSmoothing={0.18} intensity={0.2} />
      <Vignette offset={0.44} darkness={0.17} />
    </EffectComposer>
  );
}
