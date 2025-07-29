import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useRef } from "react";

export default function FollowCamera({ targetRef }) {
  const { camera, gl } = useThree();
  const yaw = useRef(0);    // horizontal rotation
  const pitch = useRef(0);  // vertical tilt
  const sensitivity = 0.003;
  const radius = 8;
  const height = 2;

  const lastMouse = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);

  useEffect(() => {
    const handleMouseDown = (e) => {
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;

      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      yaw.current -= dx * sensitivity;
      pitch.current -= dy * sensitivity;

      // Clamp pitch (optional)
      pitch.current = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch.current));
    };

    gl.domElement.addEventListener("mousedown", handleMouseDown);
    gl.domElement.addEventListener("mouseup", handleMouseUp);
    gl.domElement.addEventListener("mouseleave", handleMouseUp);
    gl.domElement.addEventListener("mousemove", handleMouseMove);

    return () => {
      gl.domElement.removeEventListener("mousedown", handleMouseDown);
      gl.domElement.removeEventListener("mouseup", handleMouseUp);
      gl.domElement.removeEventListener("mouseleave", handleMouseUp);
      gl.domElement.removeEventListener("mousemove", handleMouseMove);
    };
  }, [gl]);

  useFrame(() => {
    if (!targetRef.current) return;

    const carPos = targetRef.current.translation();
    const target = new THREE.Vector3(carPos.x, carPos.y + height, carPos.z);

    // Offset the camera based on rotation
    const offset = new THREE.Vector3(
      Math.sin(yaw.current) * Math.cos(pitch.current),
      Math.sin(pitch.current),
      Math.cos(yaw.current) * Math.cos(pitch.current)
    ).multiplyScalar(radius);

    const cameraPos = target.clone().add(offset);

    camera.position.lerp(cameraPos, 0.15); // Smooth follow
    camera.lookAt(target);
  });

  return null;
}
