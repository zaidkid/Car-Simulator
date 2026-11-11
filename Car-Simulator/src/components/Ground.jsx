import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

const IS_MOBILE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

const GRASS_TINT = "#d5dfd2";

function makeGrassTexture(maxAnisotropy) {
  const size = IS_MOBILE ? 256 : 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#315f35";
  ctx.fillRect(0, 0, size, size);

  // Deterministic texture noise: stable between renders and inexpensive to build.
  let seed = 928371;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const patches = IS_MOBILE ? 45 : 90;
  for (let i = 0; i < patches; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 12 + random() * (IS_MOBILE ? 38 : 64);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const brighter = random() > 0.64;
    gradient.addColorStop(
      0,
      brighter ? "rgba(139,166,93,0.19)" : "rgba(7,31,13,0.25)"
    );
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  const flecks = IS_MOBILE ? 2200 : 6000;
  for (let i = 0; i < flecks; i++) {
    const green = 68 + random() * 75;
    ctx.fillStyle = `rgba(${Math.round(green * 0.58)},${Math.round(green)},${Math.round(green * 0.48)},${0.08 + random() * 0.18})`;
    ctx.fillRect(random() * size, random() * size, 1 + random() * 1.4, 1 + random() * 1.8);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(260, 260);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(maxAnisotropy, IS_MOBILE ? 2 : 8);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
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
      {/* Invisible collision floor remains separate from the rendered grass. */}
      <RigidBody type="fixed" colliders={false} position={[0, -1, 0]} friction={1} restitution={0}>
        <CuboidCollider args={[10000, 1, 10000]} friction={1} restitution={0} />
      </RigidBody>

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.03, 0]}
        frustumCulled={false}
      >
        <planeGeometry args={[20000, 20000]} />
        <meshBasicMaterial map={grass} color={GRASS_TINT} toneMapped={false} />
      </mesh>
    </>
  );
}
