import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";

const IS_MOBILE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

// Multiplies the grass colour: slightly darker and cooler = grass under an overcast sky
const WET_TINT = "#c8d2ca";

function makeGrassTexture(maxAnisotropy) {
  // A smaller deterministic texture keeps startup and memory use low.
  const size = IS_MOBILE ? 256 : 384;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2b5d31";
  ctx.fillRect(0, 0, size, size);

  let seed = 928371;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Broad, subtle natural colour variation (mostly dark, damp patches).
  for (let i = 0; i < (IS_MOBILE ? 35 : 65); i++) {
    const x = random() * size;
    const y = random() * size;
    const r = 14 + random() * 48;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = random() > 0.62;

    gradient.addColorStop(
      0,
      light ? "rgba(120,150,80,0.16)" : "rgba(8,36,16,0.24)"
    );
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Sparse flecks retain a grass-like look without a costly large texture.
  const flecks = IS_MOBILE ? 1800 : 4200;
  for (let i = 0; i < flecks; i++) {
    const v = 60 + random() * 60;
    ctx.fillStyle =
      `rgba(${Math.round(v * 0.6)},${Math.round(v)},` +
      `${Math.round(v * 0.46)},${0.1 + random() * 0.16})`;
    ctx.fillRect(
      random() * size,
      random() * size,
      1 + random() * 1.2,
      1 + random() * 1.8
    );
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(260, 260);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(maxAnisotropy, IS_MOBILE ? 2 : 4);
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
      {/* Invisible collision floor; visual grass is separate. */}
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

      {/* Sits well below the track layers (y 0.045+) so the car never looks sunk in it */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.03, 0]}
        frustumCulled={false}
      >
        <planeGeometry args={[20000, 20000]} />
        {/* Basic material avoids per-pixel lighting/shadow cost on the huge floor;
            it still fades into the scene fog. */}
        <meshBasicMaterial map={grass} color={WET_TINT} />
      </mesh>
    </>
  );
}