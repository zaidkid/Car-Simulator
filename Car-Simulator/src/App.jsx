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

function SteeringWheel({ mobileRef }) {
  const wheelRef = useRef(null);
  const pointerIdRef = useRef(null);
  const [wheelAngle, setWheelAngle] = useState(0);

  const updateSteering = (event) => {
    const element = wheelRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const normalized = Math.max(
      -1,
      Math.min(1, (event.clientX - centerX) / (rect.width * 0.38))
    );

    setWheelAngle(normalized * 145);
    const steering = Math.abs(normalized) < 0.07 ? 0 : normalized;
    mobileRef.current.left = steering < 0;
    mobileRef.current.right = steering > 0;
  };

  const releaseSteering = () => {
    pointerIdRef.current = null;
    setWheelAngle(0);
    mobileRef.current.left = false;
    mobileRef.current.right = false;
  };

  return (
    <div className="steering-wheel-shell">
      <style>{`
        @media (pointer: coarse) and (orientation: landscape) {
          .mobile-controls .control-left {
            position:absolute!important;
            left:max(16px,env(safe-area-inset-left))!important;
            right:auto!important;
            bottom:max(15px,env(safe-area-inset-bottom))!important;
            top:auto!important;
            width:clamp(132px,22vh,190px);
            height:clamp(132px,22vh,190px);
            display:block!important;
            margin:0!important;
            pointer-events:none!important;
          }
          .steering-wheel-shell {
            position:absolute; inset:0; pointer-events:none;
            filter:drop-shadow(0 7px 10px rgba(0,0,0,.55));
          }
          .steering-wheel-hit {
            position:absolute; inset:0; width:100%; height:100%;
            padding:0; border:0; background:transparent; border-radius:50%;
            touch-action:none; pointer-events:auto;
            -webkit-tap-highlight-color:transparent;
          }
          .steering-wheel-svg {
            width:100%; height:100%; overflow:visible;
            transform:rotate(var(--wheel-angle,0deg));
            transform-origin:50% 50%;
            transition:transform 55ms linear;
          }
          .steering-wheel-caption {
            position:absolute; left:50%; bottom:-17px;
            transform:translateX(-50%); color:#e8edf4;
            font:900 8px/1 Arial,sans-serif; letter-spacing:2.2px;
            white-space:nowrap; text-shadow:0 2px 5px #000;
          }
        }
        @media (pointer:coarse) and (orientation:landscape) and (max-height:420px) {
          .mobile-controls .control-left {
            width:112px;height:112px;
            left:max(9px,env(safe-area-inset-left))!important;
            bottom:max(8px,env(safe-area-inset-bottom))!important;
          }
        }
      `}</style>
      <button
        ref={wheelRef}
        type="button"
        className="steering-wheel-hit"
        style={{ "--wheel-angle": `${wheelAngle}deg` }}
        aria-label="Steering wheel. Drag left or right to steer."
        onPointerDown={(event) => {
          event.preventDefault();
          pointerIdRef.current = event.pointerId;
          try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
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
        <svg className="steering-wheel-svg" viewBox="0 0 240 240" role="img" aria-hidden="true">
          <defs>
            <linearGradient id="rimMetal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#87909b"/>
              <stop offset=".18" stopColor="#202630"/>
              <stop offset=".48" stopColor="#080b10"/>
              <stop offset=".78" stopColor="#3e4651"/>
              <stop offset="1" stopColor="#090c11"/>
            </linearGradient>
            <linearGradient id="grip" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#303741"/>
              <stop offset=".45" stopColor="#080a0e"/>
              <stop offset="1" stopColor="#4a535e"/>
            </linearGradient>
            <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#24394a"/>
              <stop offset="1" stopColor="#07121d"/>
            </linearGradient>
            <radialGradient id="hub" cx=".35" cy=".25">
              <stop offset="0" stopColor="#596574"/>
              <stop offset=".55" stopColor="#202833"/>
              <stop offset="1" stopColor="#080b10"/>
            </radialGradient>
            <filter id="softGlow">
              <feGaussianBlur stdDeviation="2.2" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Carbon-fibre outer rim and metallic inner edge */}
          <circle cx="120" cy="120" r="103" fill="none" stroke="#030507" strokeWidth="25"/>
          <circle cx="120" cy="120" r="103" fill="none" stroke="url(#rimMetal)" strokeWidth="20"/>
          <circle cx="120" cy="120" r="92" fill="none" stroke="#07090d" strokeWidth="5"/>
          <path d="M45 54 A103 103 0 0 1 195 54" fill="none" stroke="#aeb7c2" strokeWidth="1.5" opacity=".48"/>
          {/* Ergonomic side grips */}
          <path d="M29 76 Q8 120 35 164 L52 153 Q34 119 53 88Z" fill="url(#grip)" stroke="#69727e" strokeWidth="1.5"/>
          <path d="M211 76 Q232 120 205 164 L188 153 Q206 119 187 88Z" fill="url(#grip)" stroke="#69727e" strokeWidth="1.5"/>
          <path d="M26 100 l12 5 M24 116 l12 3 M26 132 l12 -2 M214 100 l-12 5 M216 116 l-12 3 M214 132 l-12 -2"
            stroke="#8993a0" strokeWidth="2" opacity=".45" strokeLinecap="round"/>
          {/* Three reinforced spokes */}
          <path d="M108 133 L82 185 L105 193 L120 151 L135 193 L158 185 L132 133Z"
            fill="url(#rimMetal)" stroke="#89929e" strokeWidth="1.2"/>
          <path d="M108 111 L67 105 L62 124 L107 132Z M132 111 L173 105 L178 124 L133 132Z"
            fill="url(#rimMetal)" stroke="#89929e" strokeWidth="1.2"/>
          {/* Top shift LEDs */}
          {Array.from({length: 10}, (_, i) => (
            <rect key={i} x={82 + i * 8.4} y="24" width="6" height="5" rx="1.5"
              fill={i < 3 ? "#19d66b" : i < 7 ? "#ffd12e" : "#ff3038"}
              filter="url(#softGlow)" opacity=".95"/>
          ))}
          {/* Central display */}
          <rect x="78" y="82" width="84" height="48" rx="7" fill="#05080c" stroke="#8994a1" strokeWidth="2"/>
          <rect x="83" y="87" width="74" height="38" rx="4" fill="url(#screen)" stroke="#263c4d" strokeWidth="1"/>
          <text x="120" y="103" textAnchor="middle" fill="#9db4c7" fontSize="7" fontWeight="700" letterSpacing="1.2">APEX RACING</text>
          <text x="120" y="119" textAnchor="middle" fill="#f7fbff" fontSize="17" fontWeight="900">5 <tspan fill="#42e6a0" fontSize="7">GEAR</tspan></text>
          {/* Controls and rotary dials */}
          <circle cx="62" cy="91" r="10" fill="#c51d2a" stroke="#f27b82" strokeWidth="1.5"/>
          <circle cx="178" cy="91" r="10" fill="#1769c5" stroke="#70b5ff" strokeWidth="1.5"/>
          <circle cx="58" cy="145" r="8" fill="#e5b72c" stroke="#ffe68b" strokeWidth="1.2"/>
          <circle cx="182" cy="145" r="8" fill="#24a76a" stroke="#83f3bd" strokeWidth="1.2"/>
          <circle cx="88" cy="153" r="7" fill="#161d26" stroke="#9ba6b2" strokeWidth="1.5"/>
          <circle cx="152" cy="153" r="7" fill="#161d26" stroke="#9ba6b2" strokeWidth="1.5"/>
          <path d="M62 86v10 M57 91h10 M178 86v10 M173 91h10" stroke="#fff" strokeWidth="1.5" opacity=".8"/>
          <path d="M58 141v8 M54 145h8 M182 141v8 M178 145h8" stroke="#fff" strokeWidth="1.3" opacity=".85"/>
          {/* Centre badge */}
          <circle cx="120" cy="165" r="19" fill="url(#hub)" stroke="#aeb8c3" strokeWidth="1.5"/>
          <path d="M109 168 L120 149 L131 168 L120 163Z" fill="#e10600"/>
          <text x="120" y="178" textAnchor="middle" fill="#fff" fontSize="5.5" fontWeight="900" letterSpacing=".8">APEX</text>
        </svg>
        <span className="steering-wheel-caption">DRAG TO STEER</span>
      </button>
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