import { RigidBody } from "@react-three/rapier";
import {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

// Spark effect component
function Sparks({ position, onComplete }) {
  const meshRef = useRef();
  const life = useRef(0);

  useFrame((_, delta) => {
    life.current += delta;
    if (life.current > 0.3) onComplete();
    if (meshRef.current) {
      meshRef.current.scale.multiplyScalar(1.05);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial color="yellow" emissive="orange" emissiveIntensity={5} />
    </mesh>
  );
}

const Car = forwardRef(({ mobileControls = {} }, ref) => {
  const carRef = useRef();
  const [keys, setKeys] = useState({});
  const { camera } = useThree();
  const { scene: carModel } = useGLTF("/assets/car.glb");

  const listenerRef = useRef(null);
  const engineSoundRef = useRef(null);
  const soundLoaded = useRef(false);

  const [sparks, setSparks] = useState([]);
  const velocityRef = useRef(new THREE.Vector3()); // For smoother transitions

  useImperativeHandle(ref, () => carRef.current, []);

  // Collision handling
  const handleCollision = (e) => {
    const other = e.other.rigidBodyObject;
    if (other?.name === "building" && carRef.current) {
      const carPos = carRef.current.translation();
      const sparkPos = [carPos.x, carPos.y + 0.5, carPos.z];
      setSparks((prev) => [...prev, { id: Date.now(), position: sparkPos }]);

      const crashSound = new Audio("/sounds/crash.mp3");
      crashSound.volume = 0.4;
      crashSound.play();
    }
  };

  // Keyboard input
  useEffect(() => {
    const down = (e) => setKeys((p) => ({ ...p, [e.key.toLowerCase()]: true }));
    const up = (e) => setKeys((p) => ({ ...p, [e.key.toLowerCase()]: false }));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Prevent scroll
  useEffect(() => {
    const preventScroll = (e) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.code)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", preventScroll, { passive: false });
    return () => window.removeEventListener("keydown", preventScroll);
  }, []);

  // Load engine sound
  useEffect(() => {
    const listener = new THREE.AudioListener();
    const sound = new THREE.Audio(listener);
    const loader = new THREE.AudioLoader();

    loader.load("/sounds/engine.mp3", (buffer) => {
      sound.setBuffer(buffer);
      sound.setLoop(true);
      sound.setVolume(0.6);
      soundLoaded.current = true;
    });

    listenerRef.current = listener;
    engineSoundRef.current = sound;
  }, []);

  // Main movement + camera
  useFrame(() => {
    const body = carRef.current;
    if (!body) return;

    const speed = keys["shift"] ? 50 : 30;
    const rotationSpeed = 3;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(body.rotation());
    const moveDir = new THREE.Vector3();
    let isRotating = false;

    const isForward =
      keys["w"] || keys["arrowup"] || keys["pageup"] || mobileControls.forward;
    const isBackward =
      keys["s"] || keys["arrowdown"] || keys["pagedown"] || mobileControls.backward;
    const isLeft = keys["a"] || keys["arrowleft"] || mobileControls.left;
    const isRight = keys["d"] || keys["arrowright"] || mobileControls.right;

    if (isForward) moveDir.add(forward);
    if (isBackward) moveDir.sub(forward);
    if (isLeft) {
      body.setAngvel({ x: 0, y: rotationSpeed, z: 0 });
      isRotating = true;
    }
    if (isRight) {
      body.setAngvel({ x: 0, y: -rotationSpeed, z: 0 });
      isRotating = true;
    }
    if (!isRotating) {
      body.setAngvel({ x: 0, y: 0, z: 0 });
    }

    // Motion
    if (moveDir.length() > 0) {
      moveDir.normalize().multiplyScalar(speed);
      velocityRef.current.lerp(moveDir, 0.2); // Smooth acceleration
    } else {
      velocityRef.current.multiplyScalar(0.92); // Smooth deceleration
    }

    const currentVel = body.linvel();
    body.setLinvel(
      {
        x: velocityRef.current.x,
        y: currentVel.y,
        z: velocityRef.current.z,
      },
      true
    );

    // Engine sound control
    if (
      soundLoaded.current &&
      velocityRef.current.length() > 0.5 &&
      !engineSoundRef.current.isPlaying
    ) {
      engineSoundRef.current.play();
    } else if (
      soundLoaded.current &&
      velocityRef.current.length() < 0.1 &&
      engineSoundRef.current.isPlaying
    ) {
      engineSoundRef.current.stop();
    }

    // Camera follow
    const position = body.translation();
    const rotation = body.rotation();
    const offset = new THREE.Vector3(0, 5, -12).applyQuaternion(rotation);
    const desiredPosition = new THREE.Vector3().copy(position).add(offset);
    camera.position.lerp(desiredPosition, 0.1);
    const lookAtTarget = new THREE.Vector3().copy(position);
    camera.lookAt(lookAtTarget);
  });

  return (
    <>
      <RigidBody
        ref={carRef}
        colliders="cuboid"
        position={[0, 2, 0]}
        restitution={0.3}
        friction={1}
        canSleep={false}
        linearDamping={0.5}
        angularDamping={2}
        onCollisionEnter={handleCollision}
      >
        <primitive object={carModel.clone()} scale={0.015} />
      </RigidBody>

      {/* Sparks */}
      {sparks.map((spark) => (
        <Sparks
          key={spark.id}
          position={spark.position}
          onComplete={() =>
            setSparks((prev) => prev.filter((s) => s.id !== spark.id))
          }
        />
      ))}
    </>
  );
});

export default Car;
