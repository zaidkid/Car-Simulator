import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Sky, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

const DEFAULT_SUN = [220, 90, 120];
const SHADOW_SIZE = 45; // half-width (m) of the area around the car that gets shadows

// Put <Atmosphere /> inside <Canvas shadows>.
// Pass followRef={carRef} so the sun's shadow area follows the player car.
// The sky, reflections and sunlight all use the same sun direction.
export default function Atmosphere({ sun = DEFAULT_SUN, followRef }) {
  const { scene } = useThree();
  const light = useRef();

  const dir = useMemo(() => new THREE.Vector3(...sun).normalize(), [sun]);

  useEffect(() => {
    const { fog, environmentIntensity } = scene;

    // Fades the far end of the ground into the horizon colour.
    scene.fog = new THREE.Fog("#cfdcea", 300, 1600);
    scene.environmentIntensity = 0.7;

    const l = light.current;
    if (l) scene.add(l.target);

    return () => {
      scene.fog = fog;
      scene.environmentIntensity = environmentIntensity;
      if (l) scene.remove(l.target);
    };
  }, [scene]);

  // Keep the sun and its shadow box centred on the player car
  useFrame(() => {
    const l = light.current;
    const p = followRef?.current?.translation();
    if (!l || !p) return;

    l.position.set(p.x + dir.x * 150, p.y + dir.y * 150, p.z + dir.z * 150);
    l.target.position.set(p.x, p.y, p.z);
    l.target.updateMatrixWorld();
  });

  return (
    <>
      <Sky
        distance={2000}
        sunPosition={sun}
        turbidity={5}
        rayleigh={1.1}
        mieCoefficient={0.004}
        mieDirectionalG={0.85}
      />

      {/* Direct sunlight + soft sky/ground fill */}
      <directionalLight
        ref={light}
        position={[dir.x * 150, dir.y * 150, dir.z * 150]}
        intensity={2.2}
        color="#fff3e0"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_SIZE}
        shadow-camera-right={SHADOW_SIZE}
        shadow-camera-top={SHADOW_SIZE}
        shadow-camera-bottom={-SHADOW_SIZE}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      <hemisphereLight args={["#bcd6ff", "#4a5a3a", 0.5]} />

      <Environment resolution={256} frames={1}>
        {/* Sky dome */}
        <Lightformer
          form="rect"
          intensity={1.4}
          color="#bcd6ff"
          position={[0, 10, 0]}
          rotation-x={Math.PI / 2}
          scale={[30, 30, 1]}
        />

        {/* Sun reflection, in the same direction as the real sun */}
        <Lightformer
          form="circle"
          intensity={6}
          color="#fff1d6"
          position={dir.clone().multiplyScalar(12).toArray()}
          scale={6}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
        />

        {/* Warm horizon glow, gives the paint a soft reflection line */}
        <Lightformer
          form="ring"
          intensity={0.8}
          color="#ffe2b8"
          position={[0, 1.5, -14]}
          scale={[24, 3, 1]}
        />

        {/* Light bouncing off the ground */}
        <Lightformer
          form="rect"
          intensity={0.35}
          color="#9aa48a"
          position={[0, -6, 0]}
          rotation-x={-Math.PI / 2}
          scale={[30, 30, 1]}
        />
      </Environment>
    </>
  );
}