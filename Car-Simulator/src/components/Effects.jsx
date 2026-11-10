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

const PHONE = matchMedia("(pointer: coarse)").matches;

// Put <Effects /> inside <Canvas>, after your scene content.
// Bloom only picks up HDR values (threshold 1): start lights and sun glints.
// Phones use hardware MSAA for clean edges; desktop keeps SMAA.
export default function Effects() {
  return (
    <EffectComposer multisampling={PHONE ? 4 : 0}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.6} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL ?? ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={0.18} />
      <BrightnessContrast contrast={0.06} />
      <Vignette offset={0.35} darkness={0.4} />
      {!PHONE && <SMAA />}
    </EffectComposer>
  );
}