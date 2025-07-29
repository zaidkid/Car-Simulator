import { Canvas, useThree } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Stars, KeyboardControls } from "@react-three/drei";
import { useRef, useEffect, useState } from "react";
import * as THREE from "three";

import "./App.css";
import Car from "./components/Car";
import Ground from "./components/Ground";
import Lights from "./components/Lights";
import FollowCamera from "./components/FollowCamera";
import Buildings from "./components/Buildings";
import TrafficSystem from "./components/TrafficSystem";

function MouseCameraControls() {
  const { camera, size } = useThree();

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / size.width) * 2 - 1;
      const y = -(e.clientY / size.height) * 2 + 1;

      // Adjust sensitivity
      const sensitivity = 0.5;
      camera.position.x = x * sensitivity * 10;
      camera.position.z = 20 + y * sensitivity * 5;
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [camera, size]);

  return null;
}

function App() {
  const carRef = useRef();
  const [mobileControls, setMobileControls] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  // Honking logic
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === "h") {
        const horn = new Audio("/sounds/honk.mp3");
        horn.volume = 0.4;
        horn.play();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <KeyboardControls
        map={[
          { name: "forward", keys: ["ArrowUp", "w"] },
          { name: "backward", keys: ["ArrowDown", "s"] },
          { name: "left", keys: ["ArrowLeft", "a"] },
          { name: "right", keys: ["ArrowRight", "d"] },
          { name: "honk", keys: ["h"] },
        ]}
      >
        <Canvas
          shadows
          camera={{ position: [0, 10, 20], fov: 65 }}
          style={{ height: "100vh", background: "#87ceeb" }}
        >
          <Stars />
          <Lights />
          <Physics>
            <Car carRef={carRef} mobileControls={mobileControls} />
            <Ground />
            <Buildings />
            <TrafficSystem carRef={carRef} />
          </Physics>
          <FollowCamera targetRef={carRef} />
          <MouseCameraControls /> {/* 👈 Add camera mouse control */}
        </Canvas>
      </KeyboardControls>

      {/* 👇 Mobile Buttons Overlay */}
      <div className="mobile-controls">
        <div className="left-controls">
          <button onTouchStart={() => setMobileControls((c) => ({ ...c, left: true }))} onTouchEnd={() => setMobileControls((c) => ({ ...c, left: false }))}>
            ⬅️
          </button>
          <button onTouchStart={() => setMobileControls((c) => ({ ...c, right: true }))} onTouchEnd={() => setMobileControls((c) => ({ ...c, right: false }))}>
            ➡️
          </button>
        </div>

        <div className="right-controls">
          <button onTouchStart={() => setMobileControls((c) => ({ ...c, forward: true }))} onTouchEnd={() => setMobileControls((c) => ({ ...c, forward: false }))}>
            ⬆️
          </button>
          <button onTouchStart={() => setMobileControls((c) => ({ ...c, backward: true }))} onTouchEnd={() => setMobileControls((c) => ({ ...c, backward: false }))}>
            ⬇️
          </button>
        </div>
      </div>

      {/* CSS styles */}
      <style jsx="true">{`
        .mobile-controls {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .left-controls,
        .right-controls {
          position: absolute;
          bottom: 40px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: auto;
        }

        .left-controls {
          left: 20px;
        }

        .right-controls {
          right: 20px;
        }

        .left-controls button,
        .right-controls button {
          width: 60px;
          height: 60px;
          font-size: 24px;
          background: rgba(0, 0, 0, 0.6);
          color: white;
          border: none;
          border-radius: 10px;
        }

        @media (min-width: 768px) {
          .mobile-controls {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

export default App;
