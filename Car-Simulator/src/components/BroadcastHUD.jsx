import { useEffect, useState } from "react";

import { useGame } from "./gameStore";
import { telemetry, grid } from "./Telemetry";

import "./BroadcastHUD.css";

const MAX_KMH = 340;

export default function BroadcastHUD({
  speedRef,
  raceRef,
}) {
  const {
    phase,
    score,
    best,
    crashes,
    leaderboard,
  } = useGame();

  const [raceInfo, setRaceInfo] = useState(
    "WAITING FOR LIGHTS"
  );

  // Live vehicle data, refreshed 10 times per second
  const [live, setLive] = useState({
    kmh: 0,
    gear: 0,
    rpm: 0,
    battery: 100,
    ers: false,
    drs: false,
    surface: "track",
    lights: false,
  });

  // ========================================
  // READ RACE INFO TEXT FROM Race.jsx
  // ========================================

  useEffect(() => {
    const raceNode = raceRef?.current;

    if (!raceNode) return;

    const update = () => {
      setRaceInfo(
        raceNode.textContent || "WAITING FOR LIGHTS"
      );
    };

    const observer = new MutationObserver(update);

    observer.observe(raceNode, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    update();

    return () => observer.disconnect();
  }, [raceRef]);

  // ========================================
  // READ LIVE TELEMETRY FROM Car.jsx
  // ========================================

  useEffect(() => {
    const interval = setInterval(() => {
      setLive({
        kmh: telemetry.kmh,
        gear: telemetry.gear,
        rpm: Math.round(telemetry.rpm / 10) * 10,
        battery: telemetry.battery,
        ers: telemetry.ers,
        drs: telemetry.drs,
        surface: telemetry.surface,
        lights: grid.active,
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const speedPercentage = Math.min(
    100,
    (live.kmh / MAX_KMH) * 100
  );

  const gearLabel =
    live.gear < 0 ? "R" : live.gear === 0 ? "N" : live.gear;

  const offTrack =
    live.surface === "runoff" || live.surface === "gravel";

  const trackStatus = live.lights
    ? "START LIGHTS"
    : offTrack
    ? "OFF TRACK"
    : "GREEN FLAG";

  const statusColor = live.lights
    ? "#ffd23f"
    : offTrack
    ? "#ff4545"
    : "#00dc79";

  const player = leaderboard.find(
    (driver) => driver.id === "player"
  );

  return (
    <div className="broadcast">

      {/* ================================= */}
      {/* BRANDING */}
      {/* ================================= */}

      <div className="broadcast-brand">
        <span className="brand-slash"></span>

        APEX <span>RACING</span>

        <small>WORLD CHAMPIONSHIP</small>
      </div>

      {/* ================================= */}
      {/* TOP BROADCAST BAR */}
      {/* ================================= */}

      <div className="broadcast-top">

        <div className={`live-indicator ${
          phase === "playing" ? "is-live" : ""
        }`}>
          <span></span>

          {phase === "playing"
            ? "LIVE"
            : phase === "over"
            ? "FINISHED"
            : "STANDBY"}
        </div>

        <div className="top-stat">
          <small>SCORE</small>
          <strong>{score}</strong>
        </div>

        <div className="top-stat">
          <small>PERSONAL BEST</small>
          <strong>{best}</strong>
        </div>

        <div className="top-stat">
          <small>INCIDENTS</small>
          <strong>{crashes}</strong>
        </div>

      </div>

      {/* ================================= */}
      {/* LEFT LIVE TIMING TOWER */}
      {/* ================================= */}

      <aside className="timing-panel">

        <div className="panel-heading">
          <span>LIVE TIMING</span>

          <span className="timing-live">
            ● LIVE
          </span>
        </div>

        <div className="leaderboard-list">

          {leaderboard
            .slice()
            .sort(
              (a, b) => a.position - b.position
            )
            .map((driver) => (
              <div
                key={driver.id}
                className={`leaderboard-row ${
                  driver.id === "player"
                    ? "player-row"
                    : ""
                }`}
              >

                <div className="leaderboard-position">
                  {driver.position}
                </div>

                <div
                  className="leaderboard-team-color"
                  style={{
                    backgroundColor: driver.color,
                  }}
                />

                <div className="leaderboard-driver">
                  <strong>{driver.code}</strong>

                  <small>{driver.team}</small>
                </div>

                <div className="leaderboard-gap">
                  {driver.gap}
                </div>

              </div>
            ))}

        </div>

        {/* PLAYER INFORMATION */}

        <div className="timing-race-info">

          <small>RACE PROGRESS</small>

          <strong>{raceInfo}</strong>

        </div>

        <div className="timing-divider"></div>

        <div className="timing-footer">
          <span>SESSION</span>

          <strong>
            {phase === "playing"
              ? "RACE"
              : phase === "over"
              ? "COMPLETE"
              : "READY"}
          </strong>
        </div>

        <div className="timing-footer">
          <span>YOUR POSITION</span>

          <strong>
            {player
              ? `P${player.position}/6`
              : "—"}
          </strong>
        </div>

      </aside>

      {/* ================================= */}
      {/* RIGHT TELEMETRY */}
      {/* ================================= */}

      <aside className="telemetry-panel">

        <div className="telemetry-heading">
          VEHICLE TELEMETRY
        </div>

        <div className="speed-display">

          <strong>{live.kmh}</strong>

          <span>KM/H</span>

        </div>

        <div className="speed-bar">

          <div
            className="speed-fill"
            style={{
              width: `${speedPercentage}%`,
            }}
          />

        </div>

        <div className="gear-display">

          <div>
            <small>GEAR</small>

            <strong>{gearLabel}</strong>
          </div>

          <div>
            <small>RPM</small>

            <strong>{live.rpm}</strong>
          </div>

        </div>

        <div className="ers-section">

          <div className="ers-label">
            <span>
              {live.ers ? "ERS DEPLOYING" : "ERS ENERGY"}
            </span>

            <strong>{Math.round(live.battery)}%</strong>
          </div>

          <div className="ers-bar">
            <div
              style={{
                width: `${live.battery}%`,
                background: live.ers ? "#ffd23f" : undefined,
              }}
            />
          </div>

        </div>

        <div className="telemetry-footer">

          <span>DRS</span>

          <strong
            style={{ color: live.drs ? "#00dc79" : undefined }}
          >
            {live.drs ? "OPEN" : "CLOSED"}
          </strong>

        </div>

        <div className="telemetry-footer">

          <span>MAX SPEED</span>

          <strong>{MAX_KMH} KM/H</strong>

        </div>

      </aside>

      {/* ================================= */}
      {/* BOTTOM BROADCAST STRIP */}
      {/* ================================= */}

      <div className="broadcast-bottom">

        <div className="bottom-item">
          <span
            className="bottom-dot"
            style={{
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
            }}
          ></span>

          TRACK STATUS

          <strong>{trackStatus}</strong>
        </div>

        <div className="bottom-item">
          TYRES

          <strong>DRY / SLICK</strong>
        </div>

        <div className="bottom-item">
          WEATHER

          <strong>DRY</strong>
        </div>

        <div className="bottom-item">
          CONTROLS

          <strong>
            WASD · SHIFT ERS · E DRS · C CAMERA · R RESET
          </strong>
        </div>

      </div>

      {/* ================================= */}
      {/* HIDDEN SPEED AND RACE REFERENCES */}
      {/* ================================= */}

      <div className="broadcast-hidden">

        <div ref={speedRef}>0 km/h</div>

        <div ref={raceRef}></div>

      </div>

    </div>
  );
}