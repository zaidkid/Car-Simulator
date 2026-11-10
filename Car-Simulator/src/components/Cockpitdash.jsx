import { useEffect, useRef } from "react";

import { telemetry, raceInfo, grid } from "./Telemetry";

const LED_COUNT = 15;

const formatLap = (seconds) => {
  if (seconds === null || seconds === undefined) return "-:--.---";

  const minutes = Math.floor(seconds / 60);
  const rest = (seconds % 60).toFixed(3).padStart(6, "0");

  return `${minutes}:${rest}`;
};

const ledColor = (index) =>
  index < 5 ? "#27e06b" : index < 10 ? "#ff3b30" : "#3a8dff";

const css = `
.cd-wrap { position: fixed; inset: 0; pointer-events: none; z-index: 20;
  font-family: "Segoe UI", Roboto, Arial, sans-serif; color: #fff; }

/* ---------- wheel display ---------- */
.cd-wheel { position: absolute; left: 50%; bottom: 92px; transform: translateX(-50%);
  width: 360px; padding: 10px 16px 14px; border-radius: 22px;
  background: linear-gradient(180deg, rgba(10,12,18,.9), rgba(4,5,8,.92));
  border: 1px solid rgba(255,255,255,.10); box-shadow: 0 10px 30px rgba(0,0,0,.5); }
.cd-leds { display: flex; gap: 5px; justify-content: center; margin-bottom: 10px; }
.cd-led { width: 14px; height: 14px; border-radius: 50%; background: #1b1e26; }
.cd-row { display: flex; align-items: center; justify-content: space-between; }
.cd-batt { width: 86px; height: 86px; border-radius: 50%; display: grid; place-items: center; }
.cd-batt-in { width: 66px; height: 66px; border-radius: 50%; background: #0b0d12;
  display: grid; place-items: center; text-align: center; }
.cd-small { font-size: 10px; letter-spacing: 1.5px; color: #98a1b3; }
.cd-big { font-size: 20px; font-weight: 800; }
.cd-gear { font-size: 64px; font-weight: 900; line-height: 1; text-align: center; min-width: 70px; }
.cd-speed { text-align: center; min-width: 92px; }
.cd-speed .cd-big { font-size: 32px; }
.cd-tags { display: flex; gap: 8px; justify-content: center; margin-top: 8px; }
.cd-tag { font-size: 11px; font-weight: 800; letter-spacing: 1.5px; padding: 2px 9px;
  border-radius: 6px; background: #1b1e26; color: #5d6577; }
.cd-tag.on-drs { background: #27e06b; color: #04140a; }
.cd-tag.on-ers { background: #ffd23f; color: #181200; }

/* ---------- sector / lap box ---------- */
.cd-timing { position: absolute; right: 28px; top: 14px; width: 250px; border-radius: 10px;
  overflow: hidden; background: rgba(10,12,18,.9); border: 1px solid rgba(255,255,255,.10); }
.cd-sectors { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; background: #05060a; }
.cd-sector { font-size: 10px; letter-spacing: 1px; text-align: center; padding: 3px 0;
  background: #1b1e26; color: #7d8697; }
.cd-sector.done { background: #1f8f4e; color: #fff; }
.cd-sector.now { background: #d9a400; color: #140f00; }
.cd-bottom { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 12px; }
.cd-pos { font-size: 22px; font-weight: 800; }
.cd-pos span { font-size: 13px; color: #98a1b3; font-weight: 600; }
.cd-time { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.cd-best { padding: 0 12px 8px; font-size: 11px; color: #98a1b3; display: flex; justify-content: space-between; }

/* ---------- start lights ---------- */
.cd-start { position: absolute; left: 50%; top: 290px; transform: translateX(-50%);
  display: none; gap: 14px; padding: 12px 20px; border-radius: 14px; background: rgba(5,6,9,.85); }
.cd-bulb { width: 34px; height: 34px; border-radius: 50%; background: #2a0b0b; }
.cd-bulb.lit { background: #ff2a2a; box-shadow: 0 0 22px #ff2a2a; }
`;

export default function CockpitDash() {
  const root = useRef(null);
  const wheel = useRef(null);
  const leds = useRef([]);
  const gear = useRef(null);
  const kph = useRef(null);
  const rpm = useRef(null);
  const batt = useRef(null);
  const battText = useRef(null);
  const drs = useRef(null);
  const ers = useRef(null);
  const sectors = useRef([]);
  const pos = useRef(null);
  const lapTime = useRef(null);
  const lapInfo = useRef(null);
  const best = useRef(null);
  const start = useRef(null);
  const bulbs = useRef([]);

  useEffect(() => {
    let frame;

    const update = () => {
      frame = requestAnimationFrame(update);

      // The wheel display is only shown in the driver views
      if (wheel.current) {
        wheel.current.style.display =
          telemetry.camera === "chase" ? "none" : "block";
      }

      // Rev lights
      const fraction = clamp(
        (telemetry.rpm - 9000) / (telemetry.maxRpm - 9000),
        0,
        1
      );

      // At the limiter the whole bar flashes
      const atLimiter =
        telemetry.rpm > telemetry.maxRpm - 120 &&
        Math.floor(performance.now() / 70) % 2 === 0;

      const lit = atLimiter ? LED_COUNT : Math.floor(fraction * LED_COUNT);

      leds.current.forEach((led, index) => {
        if (!led) return;
        led.style.background = index < lit ? ledColor(index) : "#1b1e26";
      });

      if (gear.current) {
        gear.current.textContent =
          telemetry.gear === 0 ? "N" : telemetry.gear < 0 ? "R" : telemetry.gear;
      }
      if (kph.current) kph.current.textContent = telemetry.kmh;
      if (rpm.current) rpm.current.textContent = Math.round(telemetry.rpm / 5) * 5;

      if (batt.current) {
        const pct = Math.round(telemetry.battery);
        batt.current.style.background = `conic-gradient(#d7ff3a ${pct * 3.6}deg, rgba(255,255,255,.12) 0)`;
        if (battText.current) battText.current.textContent = `${pct}%`;
      }

      if (drs.current) drs.current.className = "cd-tag" + (telemetry.drs ? " on-drs" : "");
      if (ers.current) ers.current.className = "cd-tag" + (telemetry.ers ? " on-ers" : "");

      // Sector / lap box
      sectors.current.forEach((cell, index) => {
        if (!cell) return;
        const done = raceInfo.sectorTimes[index] !== null && index < raceInfo.sector - 1;
        const now = index === raceInfo.sector - 1;
        cell.className = "cd-sector" + (done || (raceInfo.finished && raceInfo.sectorTimes[index] !== null) ? " done" : now ? " now" : "");
      });

      if (pos.current) {
        pos.current.innerHTML = `${raceInfo.position} <span>/ ${raceInfo.total}</span>`;
      }
      if (lapTime.current) lapTime.current.textContent = formatLap(raceInfo.lapTime);
      if (lapInfo.current) lapInfo.current.textContent = `LAP ${raceInfo.lap}/${raceInfo.laps}`;
      if (best.current) best.current.textContent = `BEST ${formatLap(raceInfo.bestLap)}`;

      // Start lights
      if (start.current) {
        start.current.style.display = grid.active ? "flex" : "none";
        bulbs.current.forEach((bulb, index) => {
          if (bulb) bulb.className = "cd-bulb" + (index < grid.lights ? " lit" : "");
        });
      }
    };

    frame = requestAnimationFrame(update);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="cd-wrap" ref={root}>
      <style>{css}</style>

      {/* Start lights */}
      <div className="cd-start" ref={start}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="cd-bulb" ref={(el) => (bulbs.current[i] = el)} />
        ))}
      </div>

      {/* Sector / lap box */}
      <div className="cd-timing">
        <div className="cd-sectors">
          {["S1", "S2", "S3"].map((label, i) => (
            <div key={label} className="cd-sector" ref={(el) => (sectors.current[i] = el)}>
              {label}
            </div>
          ))}
        </div>
        <div className="cd-bottom">
          <div className="cd-pos" ref={pos} />
          <div className="cd-time" ref={lapTime} />
        </div>
        <div className="cd-best">
          <span ref={lapInfo} />
          <span ref={best} />
        </div>
      </div>

      {/* Steering wheel display */}
      <div className="cd-wheel" ref={wheel}>
        <div className="cd-leds">
          {Array.from({ length: LED_COUNT }, (_, i) => (
            <div key={i} className="cd-led" ref={(el) => (leds.current[i] = el)} />
          ))}
        </div>

        <div className="cd-row">
          <div className="cd-batt" ref={batt}>
            <div className="cd-batt-in">
              <div>
                <div className="cd-small">BATT</div>
                <div className="cd-big" ref={battText} />
              </div>
            </div>
          </div>

          <div className="cd-gear" ref={gear} />

          <div className="cd-speed">
            <div className="cd-small">KPH</div>
            <div className="cd-big" ref={kph} />
            <div className="cd-small" ref={rpm} />
          </div>
        </div>

        <div className="cd-tags">
          <div className="cd-tag" ref={drs}>DRS</div>
          <div className="cd-tag" ref={ers}>ERS</div>
        </div>
      </div>
    </div>
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}