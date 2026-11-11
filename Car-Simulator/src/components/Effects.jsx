import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
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
  // Skip the post-processing pipeline on low-power phones.
  // This avoids an extra full-screen render pass on constrained GPUs.
  if (LOW_POWER) return null;

  // Keep mobile effects deliberately light: no multisampling or bloom.
  if (PHONE) {
    return (
      <EffectComposer multisampling={0}>
        <ToneMapping
          mode={ToneMappingMode.ACES_FILMIC ?? ToneMappingMode.NEUTRAL}
        />
        <Vignette offset={0.44} darkness={0.16} />
      </EffectComposer>
    );
  }

  // Desktop: retain the cinematic look with a single moderate bloom pass.
  return (
    <EffectComposer multisampling={0}>
      <ToneMapping
        mode={ToneMappingMode.ACES_FILMIC ?? ToneMappingMode.NEUTRAL}
      />
      <Bloom
        mipmapBlur
        luminanceThreshold={1.2}
        luminanceSmoothing={0.2}
        intensity={0.22}
      />
      <Vignette offset={0.42} darkness={0.2} />
    </EffectComposer>
  );
}
