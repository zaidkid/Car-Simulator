import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Sky } from "@react-three/drei";
import * as THREE from "three";

const DEFAULT_SUN = [220, 90, 120];
const IS_MOBILE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
const LOW_POWER =
  IS_MOBILE &&
  typeof navigator !== "undefined" &&
  ((navigator.deviceMemory || 4) <= 4 || (navigator.hardwareConcurrency || 4) <= 4);

export default function Atmosphere({ sun = DEFAULT_SUN, followRef }) {
  const { scene } = useThree();
  const sunLight = useRef();
  const sunDirection = useMemo(
    () => new THREE.Vector3(...sun).normalize(),
    [sun]
  );

  useEffect(() => {
    const previousFog = scene.fog;
    const previousEnvironmentIntensity = scene.environmentIntensity;

    scene.fog = new THREE.Fog("#cbd8e6", 360, 1750);
    scene.environmentIntensity = IS_MOBILE ? 0.62 : 0.82;

    return () => {
      scene.fog = previousFog;
      scene.environmentIntensity = previousEnvironmentIntensity;
    };
  }, [scene]);

  useFrame(() => {
    const light = sunLight.current;
    const position = followRef?.current?.translation?.();
    if (!light || !position) return;

    // Follow the player with the light, keeping its direction consistent.
    light.position.set(
      position.x + sunDirection.x * 180,
      position.y + sunDirection.y * 180,
      position.z + sunDirection.z * 180
    );
    light.target.position.set(position.x, position.y, position.z);
    light.target.updateMatrixWorld();
  });

  return (
    <>
      <Sky
        distance={2000}
        sunPosition={sun}
        turbidity={4.8}
        rayleigh={1.15}
        mieCoefficient={0.0035}
        mieDirectionalG={0.82}
      />

      {/* Shadows stay disabled here because the current App Canvas uses shadows={false}. */}
      <directionalLight
        ref={sunLight}
        position={sunDirection.clone().multiplyScalar(180).toArray()}
        intensity={IS_MOBILE ? 2.0 : 2.35}
        color="#fff1dc"
      />
      <hemisphereLight args={["#c4d9f5", "#46543a", IS_MOBILE ? 0.58 : 0.68]} />
      <ambientLight intensity={IS_MOBILE ? 0.16 : 0.2} color="#dce7ff" />

      <Environment resolution={LOW_POWER ? 64 : IS_MOBILE ? 128 : 256} frames={1}>
        <Lightformer
          form="rect"
          intensity={1.25}
          color="#b9d4ff"
          position={[0, 10, 0]}
          rotation-x={Math.PI / 2}
          scale={[30, 30, 1]}
        />
        <Lightformer
          form="circle"
          intensity={5.2}
          color="#fff0d4"
          position={sunDirection.clone().multiplyScalar(12).toArray()}
          scale={6}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
        />
        {!IS_MOBILE && (
          <Lightformer
            form="ring"
            intensity={0.7}
            color="#ffe2bd"
            position={[0, 1.5, -14]}
            scale={[24, 3, 1]}
          />
        )}
        <Lightformer
          form="rect"
          intensity={0.3}
          color="#98a58d"
          position={[0, -6, 0]}
          rotation-x={-Math.PI / 2}
          scale={[30, 30, 1]}
        />
      </Environment>
    </>
  );
}
