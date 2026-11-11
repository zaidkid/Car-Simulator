import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

const IS_MOBILE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

function makeGrassTexture(maxAnisotropy) {
  const size = IS_MOBILE ? 256 : 512;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#315b35";
  ctx.fillRect(0, 0, size, size);

  let seed = 928371;

  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Broad colour variation
  for (
    let i = 0;
    i < (IS_MOBILE ? 65 : 115);
    i++
  ) {
    const x = random() * size;
    const y = random() * size;
    const r = 12 + random() * 58;

    const g = ctx.createRadialGradient(
      x, y, 0,
      x, y, r
    );

    const light = random() > 0.48;

    g.addColorStop(
      0,
      light
        ? "rgba(112,145,66,0.22)"
        : "rgba(13,38,20,0.24)"
    );

    g.addColorStop(1, "rgba(0,0,0,0)");

    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Fine grass-like flecks
  for (
    let i = 0;
    i < (IS_MOBILE ? 5500 : 18000);
    i++
  ) {
    const v = 65 + random() * 85;

    ctx.fillStyle =
      `rgba(${Math.round(v * 0.65)},` +
      `${Math.round(v)},` +
      `${Math.round(v * 0.52)},` +
      `${0.12 + random() * 0.2})`;

    ctx.fillRect(
      random() * size,
      random() * size,
      1 + random() * 1.2,
      1 + random() * 2.2
    );
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(520, 520);
  texture.colorSpace = THREE.SRGBColorSpace;

  texture.anisotropy = Math.min(
    maxAnisotropy,
    IS_MOBILE ? 4 : 8
  );

  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

export default function Ground() {
  const { gl } = useThree();

  const grass = useMemo(
    () =>
      makeGrassTexture(
        gl.capabilities.getMaxAnisotropy()
      ),
    [gl]
  );

  return (
    <>
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

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.025, 0]}
        receiveShadow
        frustumCulled={false}
      >
        <planeGeometry args={[20000, 20000]} />

        <meshStandardMaterial
          map={grass}
          color="#ffffff"
          roughness={1}
          metalness={0}
          dithering
        />
      </mesh>
    </>
  );
}