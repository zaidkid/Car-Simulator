import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useGLTF } from "@react-three/drei";

import "./App.css";
import "./mobile.css";

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

// Start fetching the main car asset as soon as this module is loaded.
useGLTF.preload("/models/Red_bull_car.glb");

const PHONE = matchMedia("(pointer: coarse)").matches;

function GameLoop() {
  useFrame((_, delta) => {
    game.tick(Math.min(delta, 0.1));
  });

  return null;
}

// Mounts only after everything inside the shared Suspense boundary has loaded.
function SceneReady({ onReady }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

// ---------- Mobile touch controls ----------

// Hold-to-press button (steer, gas, brake, ERS, DRS)
function ControlButton({ label, field, mobileRef, className = "" }) {
  const set = (on) => {
    mobileRef.current[field] = on;
  };

  return (
    <button
      type="button"
      className={`touch-control ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        set(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        set(false);
      }}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

// One-shot key press (camera / reset), handled by FollowCamera and Car
function TapButton({ label, keyName }) {
  return (
    <button
      type="button"
      className="touch-control"
      onPointerDown={(e) => {
        e.preventDefault();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: keyName }));
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

// [label, field, class]
const TOUCH = {
  left: [
    ["◀", "left", "steer-btn"],
    ["▶", "right", "steer-btn"],
  ],
  right: [
    ["ERS", "ers", "mini-btn"],
    ["DRS", "drs", "mini-btn"],
    ["BRAKE", "backward", "reverse-btn"],
    ["GAS", "forward", "accelerate-btn"],
  ],
};

// Fullscreen + landscape lock (Android Chrome; iOS ignores it)
const enterLandscape = async () => {
  try {
    await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.("landscape");
  } catch {}
};

// ---------- Start menu ----------

function RaceMenu({ sceneReady }) {
  const { phase } = useGame();

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.code === "Enter" &&
        !event.repeat &&
        sceneReady &&
        game.get().phase === "ready"
      ) {
        game.start();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sceneReady]);

  if (phase !== "ready") return null;

  return (
    <div className="menu-overlay">
      <section className="menu-panel">
        <div className="menu-kicker">GRAND PRIX · RACE WEEKEND</div>

        <h1>
          APEX <span>RACING</span>
        </h1>

        <p>
          Prepare for the Grand Prix. Master the racing line,
          manage your speed and fight your way to the podium.
        </p>

        <button
          className="start-button"
          disabled={!sceneReady}
          onClick={() => {
            if (sceneReady) {
              enterLandscape();
              game.start();
            }
          }}
        >
          {sceneReady ? "START GRAND PRIX" : "PREPARING CIRCUIT..."}
          <span>{sceneReady ? "↗" : "•••"}</span>
        </button>

        <div className="menu-footnote">
          {sceneReady ? "PRESS ENTER TO START" : "LOADING TRACK, CARS & GRAPHICS"}
        </div>
      </section>
    </div>
  );
}

function SceneLoading({ visible }) {
  if (!visible) return null;

  return (
    <div className="scene-loading" role="status" aria-live="polite">
      <div className="scene-loading-card">
        <div className="scene-loading-mark">APEX <span>RACING</span></div>
        <div className="scene-loading-spinner" />
        <div className="scene-loading-title">PREPARING THE CIRCUIT</div>
        <div className="scene-loading-subtitle">
          Loading cars, track and race graphics...
        </div>
      </div>
    </div>
  );
}

const EMPTY_CONTROLS = () => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  ers: false,
  drs: false,
});

export default function App() {
  const carRef = useRef(null);
  const speedRef = useRef(null);
  const raceRef = useRef(null);
  const mobileRef = useRef(EMPTY_CONTROLS());
  const [sceneReady, setSceneReady] = useState(false);

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
        dpr={[1, PHONE ? 1 : 1.25]}
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

          <Physics gravity={[0, -25, 0]} timeStep="vary">
            <Car
              carRef={carRef}
              mobileRef={mobileRef}
              hudRef={speedRef}
            />
            <Ground />
            <Race carRef={carRef} hudRef={raceRef} />
          </Physics>

          <FollowCamera targetRef={carRef} />
          <Effects />

          <SceneReady onReady={() => setSceneReady(true)} />
        </Suspense>
      </Canvas>

      <SceneLoading visible={!sceneReady} />

      {/* RACING HUD */}
      <BroadcastHUD speedRef={speedRef} raceRef={raceRef} />
      <CockpitDash />
      <MiniMap size={PHONE ? 110 : 220} />
      <StartCountdown />

      {/* MENUS */}
      <RaceMenu sceneReady={sceneReady} />
      <RaceResults onRestart={() => game.start()} />

      {/* MOBILE TOUCH CONTROLS */}
      <div className="mobile-controls">
        {Object.entries(TOUCH).map(([side, buttons]) => (
          <div key={side} className={`control-${side}`}>
            {buttons.map(([label, field, cls]) => (
              <ControlButton
                key={label}
                label={label}
                field={field}
                className={cls}
                mobileRef={mobileRef}
              />
            ))}
          </div>
        ))}

        <div className="tap-group">
          <TapButton label="CAM" keyName="c" />
          <TapButton label="RESET" keyName="r" />
        </div>
      </div>

      <div className="rotate-notice">
        <span>⟳</span>ROTATE YOUR PHONE TO LANDSCAPE
      </div>
    </main>
  );
}