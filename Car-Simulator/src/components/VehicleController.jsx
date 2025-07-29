// components/VehicleController.jsx
import { useFrame } from "@react-three/fiber";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";

export default function VehicleController({ vehicleBody }) {
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef({ forward: false, backward: false, left: false, right: false });

  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key.toLowerCase()) {
        case "w": direction.current.forward = true; break;
        case "s": direction.current.backward = true; break;
        case "a": direction.current.left = true; break;
        case "d": direction.current.right = true; break;
      }
    };
    const handleKeyUp = (e) => {
      switch (e.key.toLowerCase()) {
        case "w": direction.current.forward = false; break;
        case "s": direction.current.backward = false; break;
        case "a": direction.current.left = false; break;
        case "d": direction.current.right = false; break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Physics + movement
  useFrame(() => {
    if (!vehicleBody.current) return;

    const impulse = { x: 0, z: 0 };
    const torque = { y: 0 };

    const speed = 0.5;
    const turnSpeed = 0.2;

    if (direction.current.forward) impulse.z -= speed;
    if (direction.current.backward) impulse.z += speed;
    if (direction.current.left) torque.y += turnSpeed;
    if (direction.current.right) torque.y -= turnSpeed;

    vehicleBody.current.applyImpulseLocal(impulse, true);
    vehicleBody.current.applyTorqueImpulse(torque, true);
  });

  // Mobile buttons
  const setControl = (dir, val) => {
    direction.current[dir] = val;
  };

  return (
    <>
      {isMobile && (
        <div style={styles.controls}>
          <button style={styles.btn} onTouchStart={() => setControl("forward", true)} onTouchEnd={() => setControl("forward", false)}>↑</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={styles.btn} onTouchStart={() => setControl("left", true)} onTouchEnd={() => setControl("left", false)}>←</button>
            <button style={styles.btn} onTouchStart={() => setControl("right", true)} onTouchEnd={() => setControl("right", false)}>→</button>
          </div>
          <button style={styles.btn} onTouchStart={() => setControl("backward", true)} onTouchEnd={() => setControl("backward", false)}>↓</button>
        </div>
      )}
    </>
  );
}

const styles = {
  controls: {
    position: "absolute",
    bottom: "30px",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    zIndex: 100,
  },
  btn: {
    background: "rgba(255,255,255,0.8)",
    border: "1px solid #ccc",
    padding: "15px 20px",
    fontSize: "20px",
    borderRadius: "10px",
    userSelect: "none",
  },
};
