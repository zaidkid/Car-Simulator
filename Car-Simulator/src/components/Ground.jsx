import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

function makeGrassTexture(maxAnisotropy) {
  const size = 256;
  const canvas = document.createElement("canvas");

  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  context.fillStyle = "#4f7a4f";
  context.fillRect(0, 0, size, size);

  for (let i = 0; i < 70; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const radius = 18 + Math.random() * 40;

    const gradient = context.createRadialGradient(
      x, y, 0, x, y, radius
    );

    const light = Math.random() > 0.5;

    gradient.addColorStop(
      0,
      light
        ? "rgba(120,170,100,0.22)"
        : "rgba(30,70,35,0.22)"
    );

    gradient.addColorStop(1, "rgba(0,0,0,0)");

    context.fillStyle = gradient;
    context.fillRect(
      x - radius,
      y - radius,
      radius * 2,
      radius * 2
    );
  }

  for (let i = 0; i < 5000; i++) {
    const shade = 60 + Math.random() * 70;

    context.fillStyle =
      `rgba(${shade * 0.6}, ${shade + 40}, ${shade * 0.6}, 0.35)`;

    context.fillRect(
      Math.random() * size,
      Math.random() * size,
      1.5,
      1.5
    );
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(400, 400);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  return texture;
}

export default function Ground() {
  const { gl } = useThree();

  const grass = useMemo(
    () => makeGrassTexture(gl.capabilities.getMaxAnisotropy()),
    [gl]
  );

  return (
    <>
      {/* LARGE PHYSICS FLOOR */}

      <RigidBody
        type="fixed"
        colliders={false}
        position={[0, -1, 0]}
        friction={1}
        restitution={0}
      >
        <CuboidCollider
          args={[10000, 1, 10000]}
          friction={1}
          restitution={0}
        />
      </RigidBody>

      {/* VISUAL GRASS TERRAIN */}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.025, 0]}
        receiveShadow
      >
        <planeGeometry args={[20000, 20000]} />

        <meshStandardMaterial
          map={grass}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </>
  );
}