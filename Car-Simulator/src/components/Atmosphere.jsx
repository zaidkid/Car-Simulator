import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, Sky } from "@react-three/drei";
import * as THREE from "three";

const DEFAULT_SUN = [220, 90, 120];
const NIGHT_SKY = [220, -80, 120];
const NIGHT_LIGHT = [-120, 75, -140];
const IS_MOBILE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;
const LOW_POWER =
  IS_MOBILE &&
  typeof navigator !== "undefined" &&
  ((navigator.deviceMemory || 4) <= 4 || (navigator.hardwareConcurrency || 4) <= 4);

export default function Atmosphere({ sun = DEFAULT_SUN, followRef, night = false }) {
  const { scene, camera } = useThree();
  const sunLight = useRef();
  const nightSky = useRef();
  const skyPosition = night ? NIGHT_SKY : sun;
  const lightPosition = night ? NIGHT_LIGHT : sun;
  const skyDirection = useMemo(() => new THREE.Vector3(...skyPosition).normalize(), [skyPosition]);
  const lightDirection = useMemo(() => new THREE.Vector3(...lightPosition).normalize(), [lightPosition]);

  useEffect(() => {
    const previousFog = scene.fog;
    const previousEnvironmentIntensity = scene.environmentIntensity;

    scene.fog = night
      ? new THREE.Fog("#070b14", 300, 1850)
      : new THREE.Fog("#cbd8e6", 360, 1750);
    scene.environmentIntensity = night ? 0.3 : IS_MOBILE ? 0.62 : 0.82;

    return () => {
      scene.fog = previousFog;
      scene.environmentIntensity = previousEnvironmentIntensity;
    };
  }, [scene, night]);

  useFrame(() => {
    if (nightSky.current) nightSky.current.position.copy(camera.position);

    const light = sunLight.current;
    const position = followRef?.current?.translation?.();
    if (!light || !position) return;

    // Follow the player with the light, keeping its direction consistent.
    light.position.set(
      position.x + lightDirection.x * 180,
      position.y + lightDirection.y * 180,
      position.z + lightDirection.z * 180
    );
    light.target.position.set(position.x, position.y, position.z);
    light.target.updateMatrixWorld();
  });

  return (
    <>
      {!night && (
        <Sky
          distance={IS_MOBILE ? 3200 : 6000}
          sunPosition={skyPosition}
          turbidity={4.8}
          rayleigh={1.15}
          mieCoefficient={0.0035}
          mieDirectionalG={0.82}
        />
      )}

      {/* Shadows stay disabled here because the current App Canvas uses shadows={false}. */}
      <directionalLight
        ref={sunLight}
        position={lightDirection.clone().multiplyScalar(180).toArray()}
        intensity={night ? 0.5 : IS_MOBILE ? 2.0 : 2.35}
        color={night ? "#9bbaff" : "#fff1dc"}
      />
      <hemisphereLight args={night
        ? ["#26395f", "#10131b", 0.32]
        : ["#c4d9f5", "#46543a", IS_MOBILE ? 0.58 : 0.68]} />
      <ambientLight intensity={night ? 0.28 : IS_MOBILE ? 0.16 : 0.2}
        color={night ? "#8298d2" : "#dce7ff"} />

      <Environment resolution={LOW_POWER ? 64 : IS_MOBILE ? 192 : 256} frames={1}>
        <Lightformer
          form="rect"
          intensity={night ? 0.35 : 1.25}
          color={night ? "#34466f" : "#b9d4ff"}
          position={[0, 10, 0]}
          rotation-x={Math.PI / 2}
          scale={[30, 30, 1]}
        />
        <Lightformer
          form="circle"
          intensity={night ? 0.8 : 5.2}
          color={night ? "#8ca8e8" : "#fff0d4"}
          position={skyDirection.clone().multiplyScalar(12).toArray()}
          scale={6}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
        />
        {!IS_MOBILE && (
          <Lightformer
            form="ring"
            intensity={night ? 0.2 : 0.7}
            color={night ? "#53658b" : "#ffe2bd"}
            position={[0, 1.5, -14]}
            scale={[24, 3, 1]}
          />
        )}
        <Lightformer
          form="rect"
          intensity={night ? 0.12 : 0.3}
          color={night ? "#182234" : "#98a58d"}
          position={[0, -6, 0]}
          rotation-x={-Math.PI / 2}
          scale={[30, 30, 1]}
        />
      </Environment>

      {night && (
        <mesh ref={nightSky} renderOrder={-1000} frustumCulled={false}>
          <sphereGeometry args={[4200, 24, 16]} />
          <shaderMaterial
            side={THREE.BackSide}
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
            vertexShader={`
              varying vec3 vSkyDirection;
              void main() {
                vSkyDirection = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              varying vec3 vSkyDirection;
              void main() {
                float h = normalize(vSkyDirection).y;
                vec3 zenith = vec3(0.002, 0.004, 0.012);
                vec3 horizon = vec3(0.012, 0.027, 0.060);
                float heightBlend = smoothstep(-0.18, 0.42, h);
                float haze = exp(-pow((h - 0.015) * 10.0, 2.0)) * 0.045;
                vec3 color = mix(horizon, zenith, heightBlend);
                color += vec3(0.12, 0.19, 0.30) * haze;
                gl_FragColor = vec4(color, 1.0);
              }
            `}
          />
        </mesh>
      )}
    </>
  );
}
