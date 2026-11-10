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

// Optional. Put <Effects /> inside <Canvas>, after your scene content.
// Needs:  npm install @react-three/postprocessing postprocessing
//
// Bloom only picks up HDR values (threshold 1): start lights and sun glints.
// A little saturation and contrast keeps the image fresh and punchy, and SMAA
// cleans up the shimmering fences and kerbs.
export default function Effects() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.6} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL ?? ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.18} />
      <BrightnessContrast contrast={0.06} />
      <Vignette offset={0.35} darkness={0.4} />
      <SMAA />
    </EffectComposer>
  );
}