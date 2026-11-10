import { useEffect, useRef, useState } from "react";

import { game } from "./gameStore";
import { raceInfo } from "./Telemetry";

// End-of-race screen: chequered flag moment, podium, full classification,
// lap-by-lap times, penalties and personal bests.
// Mount <RaceResults onRestart={() => game.start()} /> outside <Canvas>.
// Race.jsx fills raceInfo.results / lapTimes / topSpeed when the race ends.
// Enter restarts the race.

const POINTS = [25, 18, 15, 12, 10, 8];
const FLAG_MS = 1800; // how long the chequered flag shows before the results

const ordinal = (n) => {
  const s = ["TH", "ST", "ND", "RD"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const fmt = (s) => {
  if (s == null) return "-:--.---";
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(3).padStart(6, "0")}`;
};

const colorOf = (d) => d.color ?? "#888";

const store = {
  get: (k) => {
    try {
      return Number(localStorage.getItem(k)) || null;
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, String(v));
    } catch {
      /* private mode: ignore */
    }
  },
};

// Takes a copy of everything shown on the screen and updates personal bests.
function takeSnapshot() {
  const rows = raceInfo.results || null;
  const me = rows ? rows.find((r) => r.player) : null;
  const finished = !!me && !me.est;

  const prevRace = store.get("apex.bestRace");
  const prevLap = store.get("apex.bestLap");

  const newRace = finished && (!prevRace || me.time < prevRace);
  const newLap = raceInfo.bestLap != null && (!prevLap || raceInfo.bestLap < prevLap);

  if (newRace) store.set("apex.bestRace", me.time);
  if (newLap) store.set("apex.bestLap", raceInfo.bestLap);

  return {
    rows,
    me,
    finished,
    timeUp: !!raceInfo.timeUp,
    newRace,
    newLap,
    prevRace,
    bestLap: raceInfo.bestLap,
    lapTimes: (raceInfo.lapTimes || []).slice(),
    topSpeed: raceInfo.topSpeed || 0,
    penalty: raceInfo.penalty || 0,
    violations: raceInfo.violations || 0,
    incidents: game.get().crashes,
  };
}

const css = `
.rr{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
  background:radial-gradient(circle at 50% 30%,rgba(20,26,38,.8),rgba(4,6,10,.94));backdrop-filter:blur(10px);color:#fff;
  font:700 13px "Arial Narrow","Roboto Condensed",Arial,sans-serif;text-transform:uppercase;animation:rrIn .5s ease-out both}
@keyframes rrIn{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:none}}
@keyframes rrRise{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes rrGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}

/* chequered flag moment */
.rr-flagwrap{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:rgba(4,6,10,.55);animation:rrIn .35s ease-out both;pointer-events:none;
  font:900 20px "Arial Narrow",Arial,sans-serif;text-transform:uppercase}
.rr-flagband{width:100%;height:56px;background:
  repeating-conic-gradient(#fff 0 25%,#0b0f16 0 50%) 0 0/56px 56px;opacity:.95}
.rr-flagtext{margin:26px 0;font:italic 1000 72px/1 "Arial Narrow",Arial,sans-serif;letter-spacing:6px;text-shadow:0 6px 30px #000}

.rr-card{width:min(980px,100%);max-height:100%;overflow:auto;background:#0b0f16;border-radius:6px;box-shadow:0 30px 80px rgba(0,0,0,.6);
  animation:rrRise .6s .05s ease-out both}
.rr-band{height:14px;background:repeating-conic-gradient(#f4f4f4 0 25%,#0b0f16 0 50%) 0 0/14px 14px}
.rr-body{padding:22px 30px 26px;border-top:3px solid #e10600}
.rr-flag{color:#ff4545;letter-spacing:5px;font-size:12px}
.rr-top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:6px 0 16px}
.rr-pos{font:italic 900 88px/1 "Arial Narrow",Arial,sans-serif}
.rr-pos small{font-size:28px;margin-left:8px;color:#aeb8c4;letter-spacing:2px}
.rr-pos.gold{color:#ffd400}
.rr-time{text-align:right;font-size:28px;font-variant-numeric:tabular-nums}
.rr-time div{font-size:11px;color:#aeb8c4;letter-spacing:2px;margin-top:2px}
.rr-badge{display:inline-block;background:#00c853;color:#06210f;padding:3px 8px;border-radius:3px;font-size:10px;letter-spacing:1.5px;margin-left:8px;vertical-align:middle}
.rr-badge.purple{background:#b24dff;color:#fff}
.rr-warn{background:#3a1212;border-left:3px solid #e10600;color:#ffb4b0;padding:8px 12px;border-radius:3px;margin-bottom:14px;font-size:11px;letter-spacing:1.5px}

.rr-pod{display:flex;justify-content:center;align-items:flex-end;gap:10px;margin:8px 0 20px}
.rr-step{width:170px;text-align:center;background:linear-gradient(#1c2431,#10151d);border-top:4px solid var(--c);padding:10px 6px 10px;
  border-radius:4px 4px 0 0;transform-origin:bottom;animation:rrGrow .6s var(--d) ease-out both;display:flex;flex-direction:column;justify-content:flex-end}
.rr-step i{display:block;font:italic 900 34px/1.1 Arial,sans-serif;color:#ffd400}
.rr-step b{display:block;font-size:22px;letter-spacing:1px}
.rr-step span{font-size:10px;color:#aeb8c4;letter-spacing:1.5px}
.rr-step em{display:block;font-style:normal;font-size:11px;color:#d8dce2;margin-top:4px;font-variant-numeric:tabular-nums}
.rr-step.me{outline:2px solid #e10600}

.rr-cols{display:grid;grid-template-columns:1.6fr 1fr;gap:22px}
@media(max-width:820px){.rr-cols{grid-template-columns:1fr}.rr-pos{font-size:64px}}
.rr-h{color:#aeb8c4;font-size:10px;letter-spacing:2px;margin:0 0 6px}
.rr-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.rr-table th{color:#aeb8c4;font-size:10px;letter-spacing:2px;text-align:left;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,.12)}
.rr-table td{padding:9px 8px;border-bottom:1px solid rgba(255,255,255,.06)}
.rr-table .num{text-align:right}
.rr-bar{display:inline-block;width:4px;height:16px;border-radius:2px;vertical-align:middle;margin-right:10px}
.rr-me td{background:linear-gradient(90deg,rgba(225,6,0,.38),rgba(225,6,0,.05));color:#fff}
.rr-est{color:#8a94a3;font-size:10px;margin-left:6px}
.rr-pen{color:#ff8a80;font-size:10px;margin-left:6px}

.rr-laps{display:flex;flex-direction:column;gap:6px}
.rr-lap{display:grid;grid-template-columns:44px 1fr 86px;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.rr-lapbar{height:8px;background:#1a212d;border-radius:4px;overflow:hidden}
.rr-lapbar div{height:100%;background:#5b6b84;border-radius:4px}
.rr-lap.best .rr-lapbar div{background:#b24dff}
.rr-lap.bad .rr-lapbar div{background:#e10600}
.rr-lap.bad span:last-child{text-decoration:line-through;color:#ff8a80}
.rr-lap.best span:last-child{color:#d9a6ff}
.rr-empty{color:#7d8795;font-size:11px;letter-spacing:1px}

.rr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin:18px 0}
.rr-stat{background:#121823;padding:10px 12px;border-radius:4px}
.rr-stat small{display:block;color:#aeb8c4;font-size:10px;letter-spacing:2px;margin-bottom:4px}
.rr-stat b{font-size:20px}
.rr-stat b.up{color:#19e676}.rr-stat b.down{color:#ff6b61}
.rr-note{color:#7d8795;font-size:10px;letter-spacing:1px;margin-bottom:14px}
.rr-btn{width:100%;border:0;cursor:pointer;background:#e10600;color:#fff;font:900 15px "Arial Narrow",Arial,sans-serif;letter-spacing:3px;
  padding:16px;border-radius:4px;display:flex;justify-content:space-between;text-transform:uppercase}
.rr-btn:hover{background:#ff1a0f}
`;

export default function RaceResults({ onRestart }) {
  const [data, setData] = useState(null);
  const [flag, setFlag] = useState(false);
  const seen = useRef(false);

  // Watch for the end of the race. Show the chequered flag first, then the results.
  useEffect(() => {
    let timer;

    const id = setInterval(() => {
      const over = game.get().phase === "over";

      if (over && !seen.current) {
        seen.current = true;
        setFlag(true);

        timer = setTimeout(() => {
          setData(takeSnapshot());
          setFlag(false);
        }, FLAG_MS);
      } else if (!over && seen.current) {
        // a new race started
        seen.current = false;
        clearTimeout(timer);
        setData(null);
        setFlag(false);
      }
    }, 150);

    return () => {
      clearInterval(id);
      clearTimeout(timer);
    };
  }, []);

  // Enter restarts
  useEffect(() => {
    if (!data) return undefined;

    const onKey = (e) => {
      if (e.code === "Enter" && !e.repeat) onRestart?.();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, onRestart]);

  if (flag) {
    return (
      <>
        <style>{css}</style>
        <div className="rr-flagwrap">
          <div className="rr-flagband" />
          <div className="rr-flagtext">Chequered flag</div>
          <div className="rr-flagband" />
        </div>
      </>
    );
  }

  if (!data) return <style>{css}</style>;

  const { rows, me, finished } = data;

  // ---- fallback if the race produced no classification ----
  if (!rows || !me) {
    return (
      <>
        <style>{css}</style>
        <div className="rr">
          <div className="rr-card">
            <div className="rr-band" />
            <div className="rr-body">
              <div className="rr-flag">Race over</div>
              <div className="rr-top">
                <div className="rr-pos">Finished</div>
              </div>
              <button className="rr-btn" onClick={() => onRestart?.()}>
                <span>Race again</span>
                <span>Enter</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const winner = rows[0];
  const podium = [rows[1], rows[0], rows[2]].filter(Boolean);
  const points = finished ? POINTS[me.position - 1] || 0 : 0;
  const gained = rows.length - me.position; // everyone starts ahead of you on the grid
  const fastest = data.lapTimes.length
    ? Math.min(...data.lapTimes.filter((l) => !l.invalid).map((l) => l.time), Infinity)
    : null;
  const slowest = data.lapTimes.length ? Math.max(...data.lapTimes.map((l) => l.time)) : 1;

  return (
    <>
      <style>{css}</style>

      <div className="rr">
        <div className="rr-card">
          <div className="rr-band" />

          <div className="rr-body">
            <div className="rr-flag">
              {data.timeUp ? "Time expired" : "Chequered flag"}
            </div>

            <div className="rr-top">
              <div className={`rr-pos ${me.position === 1 ? "gold" : ""}`}>
                P{me.position}
                <small>{ordinal(me.position)} place</small>
              </div>

              <div className="rr-time">
                {fmt(me.time)}
                {data.newRace && <span className="rr-badge">New personal best</span>}
                <div>
                  {finished ? "Race time" : "Projected race time"}
                  {data.penalty ? ` incl. +${data.penalty}s penalty` : ""}
                  {me.position > 1 && ` · +${me.gap.toFixed(3)} to winner`}
                </div>
              </div>
            </div>

            {data.timeUp && (
              <div className="rr-warn">
                Time ran out before you took the chequered flag. Result is projected.
              </div>
            )}

            {/* Podium */}
            <div className="rr-pod">
              {podium.map((r) => (
                <div
                  key={r.position}
                  className={`rr-step ${r.player ? "me" : ""}`}
                  style={{
                    "--c": colorOf(r),
                    "--d": `${(3 - r.position) * 0.12 + 0.2}s`,
                    minHeight: 84 + (4 - r.position) * 26,
                  }}
                >
                  <i>{r.position}</i>
                  <b>{r.player ? "YOU" : r.code}</b>
                  <span>{r.team}</span>
                  <em>
                    {r.position === 1 ? fmt(r.time) : `+${r.gap.toFixed(3)}`}
                  </em>
                </div>
              ))}
            </div>

            <div className="rr-cols">
              {/* Classification */}
              <div>
                <div className="rr-h">Classification</div>

                <table className="rr-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Driver</th>
                      <th>Team</th>
                      <th className="num">Gap</th>
                      <th className="num">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.position} className={r.player ? "rr-me" : ""}>
                        <td>{r.position}</td>
                        <td>
                          <span className="rr-bar" style={{ background: colorOf(r) }} />
                          {r.player ? "You" : r.code}
                          {r.player && data.penalty > 0 && (
                            <span className="rr-pen">+{data.penalty}s</span>
                          )}
                        </td>
                        <td>{r.team}</td>
                        <td className="num">
                          {r.position === 1 ? fmt(r.time) : `+${r.gap.toFixed(3)}`}
                          {r.est && <span className="rr-est">est.</span>}
                        </td>
                        <td className="num">{POINTS[r.position - 1] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Lap times */}
              <div>
                <div className="rr-h">Your laps</div>

                {data.lapTimes.length === 0 ? (
                  <div className="rr-empty">No completed laps</div>
                ) : (
                  <div className="rr-laps">
                    {data.lapTimes.map((lap, i) => {
                      const isBest = !lap.invalid && lap.time === fastest;

                      return (
                        <div
                          key={i}
                          className={`rr-lap ${isBest ? "best" : ""} ${lap.invalid ? "bad" : ""}`}
                        >
                          <span>L{i + 1}</span>
                          <div className="rr-lapbar">
                            <div style={{ width: `${(lap.time / slowest) * 100}%` }} />
                          </div>
                          <span>{fmt(lap.time)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {data.lapTimes.some((l) => l.invalid) && (
                  <div className="rr-note" style={{ marginTop: 8 }}>
                    Struck-through laps were deleted for track limits.
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="rr-stats">
              <div className="rr-stat">
                <small>Best lap</small>
                <b>{fmt(data.bestLap)}</b>
                {data.newLap && <span className="rr-badge purple">New best</span>}
              </div>

              <div className="rr-stat">
                <small>Places gained</small>
                <b className={gained > 0 ? "up" : gained < 0 ? "down" : ""}>
                  {gained > 0 ? `+${gained}` : gained}
                </b>
              </div>

              <div className="rr-stat">
                <small>Top speed</small>
                <b>{Math.round(data.topSpeed)} km/h</b>
              </div>

              <div className="rr-stat">
                <small>Points</small>
                <b>{points}</b>
              </div>

              <div className="rr-stat">
                <small>Track limits</small>
                <b>{data.violations}</b>
              </div>

              <div className="rr-stat">
                <small>Time penalties</small>
                <b>{data.penalty ? `+${data.penalty}s` : "None"}</b>
              </div>

              {data.incidents != null && (
                <div className="rr-stat">
                  <small>Incidents</small>
                  <b>{data.incidents}</b>
                </div>
              )}
            </div>

            <div className="rr-note">
              Cars still on track at the flag are shown with estimated times.
              Winner: {winner.player ? "You" : winner.code}.
            </div>

            <button className="rr-btn" onClick={() => onRestart?.()}>
              <span>Race again</span>
              <span>Enter</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}