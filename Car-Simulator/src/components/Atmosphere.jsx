import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

import { IS_MOBILE } from "./Quality";

const DEFAULT_SUN = [-120, 45, -200]; // low and hidden behind the clouds
const SHADOW_SIZE = 45; // half-width (m) of the area around the car that gets shadows
const FOG_COLOR = "#c3ccd6"; // matches the cloud-dome horizon

// Bright, cloudy sky generated on a canvas (nothing is downloaded)
function makeCloudTexture() {
  const w = IS_MOBILE ? 512 : 1024; // smaller sky texture on phones
  const h = w / 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#8fa3ba");
  sky.addColorStop(0.3, "#aebccb");
  sky.addColorStop(0.5, FOG_COLOR);
  sky.addColorStop(1, FOG_COLOR);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  let seed = 4711;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < (IS_MOBILE ? 130 : 260); i++) {
    const x = random() * w;
    const y = random() * h * 0.5;
    const r = (30 + random() * 90) * (w / 1024);
    const dark = random() > 0.45;

    for (const dx of [-w, 0, w]) {
      ctx.save();
      ctx.translate(x + dx, y);
      ctx.scale(1, 0.35);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, dark ? "rgba(120,132,148,0.12)" : "rgba(255,255,255,0.18)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Put <Atmosphere /> inside <Canvas shadows>.
// followRef={carRef} keeps the light's shadow area on the player car.
export default function Atmosphere({ sun = DEFAULT_SUN, followRef }) {
  const { scene } = useThree();
  const light = useRef();
  const dome = useRef();

  const dir = useMemo(() => new THREE.Vector3(...sun).normalize(), [sun]);
  const clouds = useMemo(makeCloudTexture, []);

  useEffect(() => {
    const { fog, environmentIntensity } = scene;

    // Soft grey haze: the far end of the track fades into the overcast sky.
    // Phones use a shorter camera range, so the haze closes in earlier to hide the edge.
    scene.fog = IS_MOBILE
      ? new THREE.Fog(FOG_COLOR, 150, 1100)
      : new THREE.Fog(FOG_COLOR, 300, 1800);
    scene.environmentIntensity = 0.8;

    const l = light.current;
    if (l) scene.add(l.target);

    return () => {
      scene.fog = fog;
      scene.environmentIntensity = environmentIntensity;
      if (l) scene.remove(l.target);
    };
  }, [scene]);

  useFrame((state) => {
    const cam = state.camera.position;

    // Sky dome always stays centred on the camera
    dome.current?.position.copy(cam);

    // Keep the light and its shadow box centred on the player car
    const l = light.current;
    const p = followRef?.current?.translation();
    if (!l || !p) return;

    l.position.set(p.x + dir.x * 150, p.y + dir.y * 150, p.z + dir.z * 150);
    l.target.position.set(p.x, p.y, p.z);
    l.target.updateMatrixWorld();
  });

  return (
    <>
      {/* Cloud cover */}
      <mesh ref={dome} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[IS_MOBILE ? 1000 : 1800, IS_MOBILE ? 24 : 32, IS_MOBILE ? 12 : 16]} />
        <meshBasicMaterial
          map={clouds}
          side={THREE.BackSide}
          fog={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Soft, cool daylight + soft sky/ground fill */}
      <directionalLight
        ref={light}
        position={[dir.x * 150, dir.y * 150, dir.z * 150]}
        intensity={2.2}
        color="#f2f5fa"
        castShadow={!IS_MOBILE}
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
      <hemisphereLight args={["#cfd9e6", "#5a6a58", 0.8]} />

      <Environment resolution={IS_MOBILE ? 128 : 256} frames={1}>
        {/* Overcast sky dome */}
        <Lightformer
          form="rect"
          intensity={1.6}
          color="#c8d6ea"
          position={[0, 10, 0]}
          rotation-x={Math.PI / 2}
          scale={[30, 30, 1]}
        />

        {/* Faint bright patch where the sun is behind the clouds */}
        <Lightformer
          form="circle"
          intensity={4}
          color="#f4f7fb"
          position={dir.clone().multiplyScalar(12).toArray()}
          scale={8}
          onUpdate={(self) => self.lookAt(0, 0, 0)}
        />

        {/* Light bouncing off the wet ground */}
        <Lightformer
          form="rect"
          intensity={0.4}
          color="#9aa89a"
          position={[0, -6, 0]}
          rotation-x={-Math.PI / 2}
          scale={[30, 30, 1]}
        />
      </Environment>
    </>
  );
}