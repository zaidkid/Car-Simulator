import { RigidBody } from "@react-three/rapier";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useRef, useMemo } from "react";
import * as THREE from "three";

// Vehicle model paths
const vehicleModels = {
  car1: "/assets/Convertible Car.glb",
  car2: "/assets/Police Car.glb",
  bus: "/assets/bus.glb",
  bike: "/assets/Motorcycle.glb",
};

// Road paths
const paths = [
  [[0, 100], [0, 100], [100, 100], [100, 0]],                   // Car1
  [[-100, 0], [-100, 200], [100, 200], [100, 0]],             // Car2
  [[-200, 50], [-200, -200], [200, -200], [200, 50]],         // Bus
  [[150, -150], [150, 150], [-150, 150], [-150, -150]]        // Bike
];

// Vehicle-specific properties
const vehicleProperties = {
  car1: { scale: 0.8, yOffset: 0.15 },
  car2: { scale: 1.6, yOffset: 0.18 },
  bus: { scale: 3.6, yOffset: 0.2 },
  bike: { scale: 0.04, yOffset: 0.1 },
};

// Vehicle Component
function Vehicle({ path, modelUrl, speed = 0.5, scale, yOffset }) {
  const ref = useRef();
  const { scene } = useGLTF(modelUrl);
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  const pointIndex = useRef(0);
  const position = useRef(new THREE.Vector3(path[0][0], 0, path[0][1]));

  useFrame(() => {
    const current = path[pointIndex.current];
    const next = path[(pointIndex.current + 1) % path.length];

    const currentPos = new THREE.Vector3(current[0], 0, current[1]);
    const nextPos = new THREE.Vector3(next[0], 0, next[1]);
    const direction = new THREE.Vector3().subVectors(nextPos, currentPos).normalize();

    position.current.addScaledVector(direction, speed);

    if (position.current.distanceTo(nextPos) < 1) {
      pointIndex.current = (pointIndex.current + 1) % path.length;
    }

    if (ref.current) {
      const newPos = new THREE.Vector3(position.current.x, yOffset, position.current.z);
      ref.current.setNextKinematicTranslation(newPos);
      const rotation = Math.atan2(direction.x, direction.z);
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotation, 0));
      ref.current.setNextKinematicRotation(quaternion);
    }
  });

  return (
    <RigidBody type="kinematicPosition" ref={ref} colliders="trimesh">
      <primitive object={clonedScene} scale={scale} />
    </RigidBody>
  );
}

// Main Traffic System
export default function TrafficSystem() {
  const vehicles = useMemo(() => [
    { type: "car1", path: paths[0], speed: 0.5 },
    { type: "car2", path: paths[1], speed: 0.55 },
    { type: "bus", path: paths[2], speed: 0.42 },
    { type: "bike", path: paths[3], speed: 0.65 },
  ], []);

  return (
    <>
      {vehicles.map((vehicle, i) => (
        <Vehicle
          key={i}
          path={vehicle.path}
          modelUrl={vehicleModels[vehicle.type]}
          speed={vehicle.speed}
          scale={vehicleProperties[vehicle.type].scale}
          yOffset={vehicleProperties[vehicle.type].yOffset}
        />
      ))}
    </>
  );
}
