import { Suspense, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";

import "./App.css";

import Car from "./components/Car";
import Ground from "./components/Ground";
import MiniMap from "./components/Minimap";
import StartCountdown from "./components/Startcountdown";
import FollowCamera from "./components/FollowCamera";
import Race from "./components/Race";
import BroadcastHUD from "./components/BroadcastHUD";
import Stadium from "./components/Stadium";
import Atmosphere from "./components/Atmosphere";
import Effects from "./components/Effects";
import CockpitDash from "./components/Cockpitdash";
import RaceResults from "./components/Raceresults";

import { game, useGame } from "./components/gameStore";

function GameLoop() {
  useFrame((_, delta) => {
    game.tick(Math.min(delta, 0.1));
  });

  return null;
}

// Mobile touch controls
function ControlButton({ label, field, mobileRef, className = "" }) {
  const handleDown = (event) => {
    event.preventDefault();

    mobileRef.current[field] = true;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may not be available on every device.
    }
  };

  const handleUp = (event) => {
    event.preventDefault();
    mobileRef.current[field] = false;
  };

  return (
    <button
      type="button"
      className={`touch-control ${className}`}
      aria-label={label}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onLostPointerCapture={() => {
        mobileRef.current[field] = false;
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {label}
    </button>
  );
}

// Start menu
function RaceMenu() {
  const { phase, score, best, crashes } = useGame();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.code === "Enter" &&
        !event.repeat &&
        game.get().phase === "ready"
      ) {
        game.start();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  if (phase !== "ready") return null;

  return (
    <div className="menu-overlay">
      <section className="menu-panel">
        <div className="menu-kicker">
          GRAND PRIX · RACE WEEKEND
        </div>

        <h1>
          APEX <span>RACING</span>
        </h1>

        <p>
          Prepare for the Grand Prix. Master the racing line,
          manage your speed and fight your way to the podium.
        </p>

        <button
          className="start-button"
          onClick={() => game.start()}
        >
          START GRAND PRIX
          <span>↗</span>
        </button>

        <div className="menu-footnote">
          PRESS ENTER TO START
        </div>
      </section>
    </div>
  );
}

const EMPTY_CONTROLS = () => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
});

export default function App() {
  const carRef = useRef(null);
  const speedRef = useRef(null);
  const raceRef = useRef(null);

  const mobileRef = useRef(EMPTY_CONTROLS());

  // CENTRAL KEYBOARD INPUT
  useEffect(() => {
    const keyMap = {
      KeyW: "forward",
      ArrowUp: "forward",

      KeyS: "backward",
      ArrowDown: "backward",

      KeyA: "left",
      ArrowLeft: "left",

      KeyD: "right",
      ArrowRight: "right",
    };

    const handleKeyDown = (event) => {
      const field = keyMap[event.code];

      if (!field) return;

      event.preventDefault();
      mobileRef.current[field] = true;
    };

    const handleKeyUp = (event) => {
      const field = keyMap[event.code];

      if (!field) return;

      event.preventDefault();
      mobileRef.current[field] = false;
    };

    const clearControls = () => {
      mobileRef.current = EMPTY_CONTROLS();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", clearControls);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", clearControls);
    };
  }, []);

  return (
    <main className="app-shell">

      <Canvas
        shadows
        dpr={[1, 1.25]}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{
          position: [0, 7, -13],
          fov: 60,
          near: 0.2,
          far: 2500,
        }}
      >
        <color attach="background" args={["#cfdcea"]} />

        <GameLoop />

        <Suspense fallback={null}>
          <Atmosphere />

          <Stadium />

          <Physics
            gravity={[0, -25, 0]}
            timeStep="vary"
          >
            <Car
              carRef={carRef}
              mobileRef={mobileRef}
              hudRef={speedRef}
            />

            <Ground />

            <Race
              carRef={carRef}
              hudRef={raceRef}
            />
          </Physics>

          <FollowCamera targetRef={carRef} />

          <Effects />
        </Suspense>
      </Canvas>

      {/* RACING HUD */}
      <BroadcastHUD
        speedRef={speedRef}
        raceRef={raceRef}
      />

      <CockpitDash />

      <MiniMap />

      <StartCountdown />

      {/* MENUS */}
      <RaceMenu />

      <RaceResults
        onRestart={() => game.start()}
      />

      {/* MOBILE TOUCH CONTROLS */}
      <div className="mobile-controls">

        {/* LEFT SIDE: REVERSE + LEFT TURN */}
        <div className="control-left">

          <ControlButton
            label="REV"
            field="backward"
            mobileRef={mobileRef}
            className="reverse-btn"
          />

          <ControlButton
            label="◀"
            field="left"
            mobileRef={mobileRef}
            className="steer-btn"
          />

        </div>

        {/* RIGHT SIDE: ACCELERATE + RIGHT TURN */}
        <div className="control-right">

          <ControlButton
            label="▲"
            field="forward"
            mobileRef={mobileRef}
            className="accelerate-btn"
          />

          <ControlButton
            label="▶"
            field="right"
            mobileRef={mobileRef}
            className="steer-btn"
          />

        </div>

      </div>

    </main>
  );
}