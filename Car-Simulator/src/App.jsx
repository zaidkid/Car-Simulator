import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { useGLTF, PerformanceMonitor } from "@react-three/drei";

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
import "./mobile.css";

useGLTF.preload("/models/Red_bull_car.glb");

const PHONE = matchMedia("(pointer: coarse)").matches;

const EMPTY_CONTROLS = () => ({
  forward: false,
  backward: false,
  left: false,
  right: false,
  ers: false,
  drs: false,
});

function GameLoop({ paused }) {
  useFrame((_, delta) => {
    if (!paused) {
      game.tick(Math.min(delta, 0.1));
    }
  });

  return null;
}

function SceneReady({ onReady }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

// --------------------------------------------------
// MOBILE CONTROLS
// --------------------------------------------------

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

function SteeringWheelModel({ angle }) {
  const { scene } = useGLTF("/models/sports-steering-wheel.glb");
  const model = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={model}
      rotation={[0, 0, THREE_DEG_TO_RAD * angle]}
      scale={2.65}
      position={[0, 0, 0]}
    />
  );
}

const THREE_DEG_TO_RAD = Math.PI / 180;

function SteeringWheel({ mobileRef }) {
  const wheelRef = useRef(null);
  const pointerIdRef = useRef(null);
  const [angle, setAngle] = useState(0);

  const updateSteering = (event) => {
    const element = wheelRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const normalized = Math.max(
      -1,
      Math.min(1, (event.clientX - centerX) / (rect.width * 0.34))
    );

    const wheelAngle = normalized * 150;
    setAngle(wheelAngle);

    // Existing Car.jsx consumes left/right booleans. Keep that API intact.
    // A small dead zone avoids accidental steering when the wheel is centred.
    const steering = Math.abs(normalized) < 0.07 ? 0 : normalized;
    mobileRef.current.left = steering < 0;
    mobileRef.current.right = steering > 0;
  };

  const releaseSteering = () => {
    pointerIdRef.current = null;
    setAngle(0);
    mobileRef.current.left = false;
    mobileRef.current.right = false;
  };

  return (
    <>
      <style>{`
        @media (pointer: coarse) and (orientation: landscape) {
          .mobile-controls .control-left {
            position: absolute !important;
            left: max(14px, env(safe-area-inset-left)) !important;
            right: auto !important;
            bottom: max(14px, env(safe-area-inset-bottom)) !important;
            top: auto !important;
            width: clamp(124px, 22vh, 184px);
            height: clamp(124px, 22vh, 184px);
            display: block !important;
            margin: 0 !important;
            pointer-events: none !important;
          }
          .steering-wheel-control {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            padding: 0;
            border: 0;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(15,19,26,.22), rgba(5,8,13,.05) 68%, transparent 70%);
            touch-action: none;
            pointer-events: auto;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
          }
          .steering-wheel-control canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
            pointer-events: none;
          }
          .steering-wheel-caption {
            position: absolute;
            left: 50%;
            bottom: -15px;
            transform: translateX(-50%);
            color: rgba(255,255,255,.9);
            font: 900 8px/1 Arial,sans-serif;
            letter-spacing: 2px;
            text-shadow: 0 2px 5px #000;
            white-space: nowrap;
            pointer-events: none;
          }
        }
        @media (pointer: coarse) and (orientation: landscape) and (max-height: 420px) {
          .mobile-controls .control-left {
            width: 108px;
            height: 108px;
            left: max(8px, env(safe-area-inset-left)) !important;
            bottom: max(8px, env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>

      <button
        ref={wheelRef}
        type="button"
        className="steering-wheel-control"
        aria-label="Steering wheel. Drag left or right to steer."
        onPointerDown={(event) => {
          event.preventDefault();
          pointerIdRef.current = event.pointerId;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {}
          updateSteering(event);
        }}
        onPointerMove={(event) => {
          if (pointerIdRef.current !== event.pointerId) return;
          event.preventDefault();
          updateSteering(event);
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          if (pointerIdRef.current === event.pointerId) releaseSteering();
        }}
        onPointerCancel={releaseSteering}
        onLostPointerCapture={releaseSteering}
        onContextMenu={(event) => event.preventDefault()}
      >
        <Canvas
          orthographic
          camera={{ position: [0, 0, 5], zoom: 115, near: 0.1, far: 30 }}
          gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
          dpr={1}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <ambientLight intensity={1.8} />
          <directionalLight position={[2, 3, 5]} intensity={2.2} />
          <directionalLight position={[-3, -2, 2]} intensity={0.8} />
          <group rotation={[0, 0, THREE_DEG_TO_RAD * angle]}>
            <SteeringWheelModel angle={0} />
          </group>
        </Canvas>
        <span className="steering-wheel-caption">STEER</span>
      </button>
    </>
  );
}

function TapButton({ label, keyName }) {
  return (
    <button
      type="button"
      className="touch-control"
      onPointerDown={(e) => {
        e.preventDefault();

        window.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: keyName,
            code: keyName === "r" ? "KeyR" : "KeyC",
            bubbles: true,
          })
        );
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

const TOUCH = {
  right: [
    ["ERS", "ers", "mini-btn"],
    ["DRS", "drs", "mini-btn"],
    ["BRAKE", "backward", "reverse-btn"],
    ["GAS", "forward", "accelerate-btn"],
  ],
};

const enterLandscape = async () => {
  try {
    await document.documentElement.requestFullscreen?.();
    await screen.orientation?.lock?.("landscape");
  } catch {}
};

// --------------------------------------------------
// START MENU
// --------------------------------------------------

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
          {sceneReady
            ? "PRESS ENTER TO START"
            : "LOADING TRACK, CARS & GRAPHICS"}
        </div>
      </section>
    </div>
  );
}

// --------------------------------------------------
// PAUSE / GAME MENU
// --------------------------------------------------

function GameMenu({ paused, setPaused, onRestart, onResetCar }) {
  const [open, setOpen] = useState(false);
  const { phase } = useGame();

  useEffect(() => {
    if (paused) setOpen(false);
  }, [paused]);

  if (phase === "ready") return null;

  const closeMenu = () => setOpen(false);

  return (
    <>
      {!paused && (
        <div className="game-menu">
          <button
            type="button"
            className={`game-menu-toggle ${open ? "is-open" : ""}`}
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "Close game menu" : "Open game menu"}
            aria-expanded={open}
          >
            <span className="menu-toggle-lines" aria-hidden="true">
              <i /><i />
            </span>
            <span>MENU</span>
          </button>

          {open && (
            <>
              <button
                type="button"
                className="game-menu-backdrop"
                aria-label="Close menu"
                onClick={closeMenu}
              />
              <section className="game-menu-panel" aria-label="Race menu">
                <div className="game-menu-heading">
                  <span>APEX <b>RACING</b></span>
                  <small>RACE CONTROL</small>
                </div>

                {phase === "playing" && (
                  <button
                    type="button"
                    className="game-menu-action primary"
                    onClick={() => {
                      closeMenu();
                      setPaused(true);
                    }}
                  >
                    <span className="action-pause-icon">| |</span>
                    PAUSE RACE
                  </button>
                )}

                <button
                  type="button"
                  className="game-menu-action"
                  onClick={() => {
                    closeMenu();
                    setPaused(false);
                    onResetCar();
                  }}
                >
                  <span>↺</span>
                  RESET CAR
                </button>

                <button
                  type="button"
                  className="game-menu-action restart"
                  onClick={() => {
                    closeMenu();
                    setPaused(false);
                    onRestart();
                  }}
                >
                  <span>⟲</span>
                  RESTART RACE
                </button>

                <button type="button" className="game-menu-close" onClick={closeMenu}>
                  BACK TO RACE
                </button>
              </section>
            </>
          )}
        </div>
      )}

      {paused && (
        <div className="pause-overlay">
          <button
            type="button"
            className="pause-icon-only"
            onClick={() => setPaused(false)}
            aria-label="Resume race"
            title="Resume race"
          >
            Ⅱ
          </button>
        </div>
      )}
    </>
  );
}

// --------------------------------------------------
// LOADING SCREEN
// --------------------------------------------------

function SceneLoading({ visible }) {
  if (!visible) return null;

  return (
    <div className="scene-loading">
      <div className="scene-loading-card">
        <div className="scene-loading-mark">
          APEX <span>RACING</span>
        </div>

        <div className="scene-loading-spinner" />

        <div className="scene-loading-title">
          PREPARING THE CIRCUIT
        </div>

        <div className="scene-loading-subtitle">
          Loading cars, track and race graphics...
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------
// MAIN APP
// --------------------------------------------------

export default function App() {
  const carRef = useRef(null);
  const speedRef = useRef(null);
  const raceRef = useRef(null);

  const mobileRef = useRef(EMPTY_CONTROLS());

  const [sceneReady, setSceneReady] = useState(false);
  const [paused, setPaused] = useState(false);

  const [dpr, setDpr] = useState(PHONE ? 1.75 : 1.25);

  // Keyboard controls
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

  // Prevent held controls from remaining active while paused.
  useEffect(() => {
    if (paused) {
      mobileRef.current = EMPTY_CONTROLS();
    }
  }, [paused]);

  // Restart by transitioning out of playing before starting again.
  const restartRace = () => {
    setPaused(false);
    game.end();

    requestAnimationFrame(() => {
      game.start();
    });
  };

  // Use the existing R-key reset functionality in Car.jsx.
  const resetCar = () => {
    mobileRef.current = EMPTY_CONTROLS();

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "r",
        code: "KeyR",
        bubbles: true,
      })
    );

    window.dispatchEvent(
      new KeyboardEvent("keyup", {
        key: "r",
        code: "KeyR",
        bubbles: true,
      })
    );
  };

  return (
    <main className="app-shell">

      <Canvas
        shadows
        dpr={dpr}
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

        <PerformanceMonitor
          onDecline={() => {
            setDpr((d) => Math.max(1, d - 0.25));
          }}
          onIncline={() => {
            setDpr((d) => Math.min(PHONE ? 2 : 1.5, d + 0.25));
          }}
        />

        <color attach="background" args={["#cfdcea"]} />

        <GameLoop paused={paused} />

        <Suspense fallback={null}>

          <Atmosphere />
          <Stadium />

          <Physics
            gravity={[0, -25, 0]}
            timeStep="vary"
            paused={paused}
          >
            <Car
              carRef={carRef}
              mobileRef={mobileRef}
              hudRef={speedRef}
              paused={paused}
            />

            <Ground />

            <Race
              carRef={carRef}
              hudRef={raceRef}
              paused={paused}
            />
          </Physics>

          <FollowCamera targetRef={carRef} />

          <Effects />

          <SceneReady
            onReady={() => setSceneReady(true)}
          />

        </Suspense>
      </Canvas>

      <SceneLoading visible={!sceneReady} />

      {/* RACING HUD */}

      <BroadcastHUD
        speedRef={speedRef}
        raceRef={raceRef}
      />

      <CockpitDash />

      <MiniMap size={PHONE ? 110 : 220} />

      <StartCountdown />

      {/* START MENU */}

      <RaceMenu sceneReady={sceneReady} />

      {/* PAUSE / RESTART MENU */}

      <GameMenu
        paused={paused}
        setPaused={setPaused}
        onRestart={restartRace}
        onResetCar={resetCar}
      />

      {/* RESULTS */}

      <RaceResults
        onRestart={restartRace}
      />

      {/* MOBILE CONTROLS */}

      <div className="mobile-controls">

        <div className="control-left">
          <SteeringWheel mobileRef={mobileRef} />
        </div>

        <div className="control-right">
          {TOUCH.right.map(([label, field, cls]) => (
            <ControlButton
              key={label}
              label={label}
              field={field}
              className={cls}
              mobileRef={mobileRef}
            />
          ))}
        </div>

        <div className="tap-group">
          <TapButton label="CAM" keyName="c" />
          <TapButton label="RESET" keyName="r" />
        </div>

      </div>

      <div className="rotate-notice">
        <span>⟳</span>
        ROTATE YOUR PHONE TO LANDSCAPE
      </div>

    </main>
  );
}