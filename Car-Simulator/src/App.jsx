import { Suspense, useEffect, useRef, useState } from "react";
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

const PHONE =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

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

// MOBILE CONTROL LAYOUT
const MOBILE_LAYOUT_CSS = `
@media (pointer: coarse) and (orientation: landscape) {

  .mobile-controls .control-left,
  .mobile-controls .control-right {
    position: fixed !important;
    inset: 0 !important;
    display: block !important;
    pointer-events: none !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .mobile-controls .touch-control {
    position: absolute !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    pointer-events: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    touch-action: none !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    -webkit-tap-highlight-color: transparent !important;
  }

  .mobile-controls .steer-btn {
    width: clamp(88px, 25vh, 118px) !important;
    height: clamp(88px, 25vh, 118px) !important;
    bottom: max(18px, env(safe-area-inset-bottom)) !important;
    border-radius: 24px !important;
    font-size: 42px !important;
    font-weight: 900 !important;
  }

  .mobile-controls .steer-left {
    left: max(18px, env(safe-area-inset-left)) !important;
  }

  .mobile-controls .steer-right {
    left: calc(
      max(18px, env(safe-area-inset-left)) +
      clamp(88px, 25vh, 118px) + 22px
    ) !important;
  }

  .mobile-controls .accelerate-btn {
    width: clamp(116px, 36vh, 158px) !important;
    height: clamp(116px, 36vh, 158px) !important;
    right: max(18px, env(safe-area-inset-right)) !important;
    bottom: max(18px, env(safe-area-inset-bottom)) !important;
    font-size: 20px !important;
    font-weight: 900 !important;
    border-radius: 27px !important;
  }

  .mobile-controls .reverse-btn {
    width: clamp(88px, 27vh, 116px) !important;
    height: clamp(88px, 27vh, 116px) !important;
    right: calc(
      max(18px, env(safe-area-inset-right)) +
      clamp(116px, 36vh, 158px) + 26px
    ) !important;
    bottom: max(18px, env(safe-area-inset-bottom)) !important;
    font-size: 16px !important;
    font-weight: 900 !important;
    border-radius: 23px !important;
  }

  .mobile-controls .mini-btn {
    width: 54px !important;
    height: 54px !important;
    bottom: calc(
      max(18px, env(safe-area-inset-bottom)) +
      clamp(116px, 36vh, 158px) + 13px
    ) !important;
    font-size: 12px !important;
  }

  .mobile-controls .mini-btn:nth-child(1) {
    right: calc(
      max(18px, env(safe-area-inset-right)) + 54px + 12px
    ) !important;
  }

  .mobile-controls .mini-btn:nth-child(2) {
    right: max(18px, env(safe-area-inset-right)) !important;
  }
}

@media (pointer: coarse) and
(orientation: landscape) and (max-height: 420px) {

  .mobile-controls .steer-btn {
    width: 76px !important;
    height: 76px !important;
    bottom: max(10px, env(safe-area-inset-bottom)) !important;
    border-radius: 19px !important;
  }

  .mobile-controls .steer-right {
    left: calc(
      max(10px, env(safe-area-inset-left)) + 76px + 16px
    ) !important;
  }

  .mobile-controls .steer-left {
    left: max(10px, env(safe-area-inset-left)) !important;
  }

  .mobile-controls .accelerate-btn {
    width: 104px !important;
    height: 104px !important;
    right: max(10px, env(safe-area-inset-right)) !important;
    bottom: max(10px, env(safe-area-inset-bottom)) !important;
  }

  .mobile-controls .reverse-btn {
    width: 78px !important;
    height: 78px !important;
    right: calc(
      max(10px, env(safe-area-inset-right)) + 104px + 18px
    ) !important;
    bottom: max(10px, env(safe-area-inset-bottom)) !important;
  }

  .mobile-controls .mini-btn {
    width: 46px !important;
    height: 46px !important;
    bottom: calc(
      max(10px, env(safe-area-inset-bottom)) + 104px + 10px
    ) !important;
  }
}
`;

function ControlButton({
  label,
  field,
  mobileRef,
  className = "",
}) {
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

const TOUCH = {
  left: [
    ["<", "left", "steer-btn steer-left"],
    [">", "right", "steer-btn steer-right"],
  ],

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

// START MENU
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

    return () =>
      window.removeEventListener("keydown", handleKeyDown);
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
          {sceneReady
            ? "START GRAND PRIX"
            : "PREPARING CIRCUIT..."}

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

// PAUSE MENU
function GameMenu({
  paused,
  setPaused,
  onRestart,
  onResetCar,
}) {
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
            className={`game-menu-toggle ${
              open ? "is-open" : ""
            }`}
            onClick={() => setOpen((value) => !value)}
            aria-label="Game menu"
            aria-expanded={open}
          >
            <span className="menu-toggle-lines">
              <i />
              <i />
            </span>
            <span>MENU</span>
          </button>

          {open && (
            <>
              <button
                type="button"
                className="game-menu-backdrop"
                onClick={closeMenu}
              />

              <section className="game-menu-panel">
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
                    <span>| |</span>
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

                <button
                  type="button"
                  className="game-menu-close"
                  onClick={closeMenu}
                >
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
          >
            Ⅱ
          </button>
        </div>
      )}
    </>
  );
}

// LOADING SCREEN
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
            code:
              keyName === "r" ? "KeyR" : "KeyC",
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

// MAIN APP
export default function App() {
  const carRef = useRef(null);
  const speedRef = useRef(null);
  const raceRef = useRef(null);

  const mobileRef = useRef(EMPTY_CONTROLS());

  const [sceneReady, setSceneReady] = useState(false);
  const [paused, setPaused] = useState(false);

  const [dpr, setDpr] = useState(
    PHONE ? 1.1 : 1.35
  );

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

  useEffect(() => {
    if (paused) {
      mobileRef.current = EMPTY_CONTROLS();
    }
  }, [paused]);

  const restartRace = () => {
    setPaused(false);
    game.end();

    requestAnimationFrame(() => {
      game.start();
    });
  };

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
        shadows={!PHONE}
        dpr={dpr}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          alpha: false,
          stencil: false,
          depth: true,
          preserveDrawingBuffer: false,
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
            setDpr((d) =>
              Math.max(PHONE ? 0.8 : 1, d - 0.15)
            );
          }}
          onIncline={() => {
            setDpr((d) =>
              Math.min(PHONE ? 1.35 : 1.65, d + 0.1)
            );
          }}
          onFallback={() =>
            setDpr(PHONE ? 0.85 : 1)
          }
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

      <BroadcastHUD
        speedRef={speedRef}
        raceRef={raceRef}
      />

      <CockpitDash />

      <MiniMap size={PHONE ? 110 : 220} />

      <StartCountdown />

      <RaceMenu sceneReady={sceneReady} />

      <GameMenu
        paused={paused}
        setPaused={setPaused}
        onRestart={restartRace}
        onResetCar={resetCar}
      />

      <RaceResults onRestart={restartRace} />

      <div className="mobile-controls">
        <style>{MOBILE_LAYOUT_CSS}</style>

        <div className="control-left">
          {TOUCH.left.map(([label, field, cls]) => (
            <ControlButton
              key={label}
              label={label}
              field={field}
              className={cls}
              mobileRef={mobileRef}
            />
          ))}
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