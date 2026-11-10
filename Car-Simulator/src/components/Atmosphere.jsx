import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Sky, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

// Put <Atmosphere /> inside <Canvas>.
// Adds a real sky with a horizon, distance fog and soft reflections for the
// car paint. Everything is generated locally, nothing is downloaded.
export default function Atmosphere({ sun = [220, 90, 120] }) {
  const { scene } = useThree();

  useEffect(() => {
    const previousFog = scene.fog;

    // Fades the far end of the ground into the horizon colour.
    scene.fog = new THREE.Fog("#cfdcea", 350, 1700);

    // Keeps the image-based lighting from washing the scene out.
    scene.environmentIntensity = 0.7;

    return () => {
      scene.fog = previousFog;
    };
  }, [scene]);

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

        {/* Sun */}
        <Lightformer
          form="circle"
          intensity={6}
          color="#fff1d6"
          position={[10, 6, 6]}
          scale={6}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
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