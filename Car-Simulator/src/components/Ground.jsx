import React, { useMemo } from "react";
import { RigidBody } from "@react-three/rapier";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

// Helper: Dashed lines for minor roads
const createDashedLines = (length, dash = 5, gap = 3, width = 0.25, color = "#f2f2edff") => {
  const lines = [];
  const segments = Math.floor(length / (dash + gap));
  for (let i = 0; i < segments; i++) {
    const offset = -length / 2 + i * (dash + gap) + dash / 2;
    lines.push(
      <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, offset]}>
        <planeGeometry args={[width, dash]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>
    );
  }
  return lines;
};

// Road segment
const Road = ({ position = [0, 0.02, 0], size = [20, 300], type = "major" }) => {
  const [width, length] = size;
  const roadColor = { highway: "#1a1a1a", major: "#2c2c2c", minor: "#404040" }[type] || "#333";

  return (
    <RigidBody type="fixed" colliders="trimesh">
      <group position={position}>
        {/* Road surface */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[width, length]} />
          <meshStandardMaterial color={roadColor} roughness={1} />
        </mesh>

        {/* Markings */}
        {type === "major" && (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.3, 0.015, 0]}>
              <planeGeometry args={[0.25, length]} />
              <meshStandardMaterial color="#f2f2edff" emissive="#f2f2edff" emissiveIntensity={0.3} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.3, 0.015, 0]}>
              <planeGeometry args={[0.25, length]} />
              <meshStandardMaterial color="#f2f2edff" emissive="#f2f2edff" emissiveIntensity={0.3} />
            </mesh>
          </>
        )}

        {type === "minor" && <group>{createDashedLines(length)}</group>}

        {/* Sidewalks */}
        {(type === "major" || type === "minor") && (
          <>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-width / 2 - 1, 0.01, 0]}>
              <planeGeometry args={[1, length]} />
              <meshStandardMaterial color="#7a7a7a" />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2 + 1, 0.01, 0]}>
              <planeGeometry args={[1, length]} />
              <meshStandardMaterial color="#7a7a7a" />
            </mesh>
          </>
        )}
      </group>
    </RigidBody>
  );
};

// Intersection
const Intersection = ({ position = [0, 0.02, 0], size = 30 }) => {
  const roadColor = "#2c2c2c";
  const laneColor = "#f2f2edff";

  return (
    <RigidBody type="fixed" colliders="trimesh">
      <group position={position}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size, size]} />
          <meshStandardMaterial color={roadColor} roughness={1} />
        </mesh>

        {/* Turning markings */}
        {[-1, 1].flatMap((dx) =>
          [-1, 1].map((dz, i) => (
            <mesh
              key={`${dx}-${dz}-${i}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[dx * 5, 0.011, dz * 5]}
            >
              <planeGeometry args={[3, 6]} />
              <meshStandardMaterial color={laneColor} emissive={laneColor} emissiveIntensity={0.3} />
            </mesh>
          ))
        )}
      </group>
    </RigidBody>
  );
};

// Infinite Ground & Road Grid
export default function Ground({ playerPosition = [0, 0, 0] }) {
  const texture = useTexture("./assets/Texture.jpg");
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100);

  const blockSize = 120;
  const visibleRange = 3;

  const [px, , pz] = playerPosition;
  const currentX = Math.round(px / blockSize);
  const currentZ = Math.round(pz / blockSize);

  const roads = useMemo(() => {
    const result = [];

    for (let ix = -visibleRange; ix <= visibleRange; ix++) {
      for (let iz = -visibleRange; iz <= visibleRange; iz++) {
        const x = (currentX + ix) * blockSize;
        const z = (currentZ + iz) * blockSize;
        const key = `${x}-${z}`;

        if ((currentX + ix) % 2 === 0) {
          result.push(<Road key={`vroad-${key}`} position={[x, 0.02, z]} size={[12, blockSize]} type="major" />);
        }

        if ((currentZ + iz) % 2 === 0) {
          result.push(<Road key={`hroad-${key}`} position={[x, 0.02, z]} size={[blockSize, 12]} type="major" />);
        }

        if ((currentX + ix) % 2 !== 0) {
          result.push(<Road key={`vminor-${key}`} position={[x + 30, 0.02, z]} size={[8, blockSize]} type="minor" />);
        }

        if ((currentZ + iz) % 2 !== 0) {
          result.push(<Road key={`hminor-${key}`} position={[x, 0.02, z + 30]} size={[blockSize, 8]} type="minor" />);
        }

        if ((currentX + ix) % 2 === 0 && (currentZ + iz) % 2 === 0) {
          result.push(<Intersection key={`int-${key}`} position={[x, 0.03, z]} size={30} />);
        }
      }
    }

    return result;
  }, [currentX, currentZ]);

  return (
    <>
      {/* Base city terrain */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[2000, 2000]} />
          <meshStandardMaterial map={texture} />
        </mesh>
      </RigidBody>

      {/* Roads */}
      {roads}
    </>
  );
}
