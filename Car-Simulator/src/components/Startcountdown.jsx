import { useEffect, useRef } from "react";

import { grid } from "./Telemetry";

const css = `
.sc-wrap { position: fixed; left: 0; right: 0; top: 30%; z-index: 25; pointer-events: none;
  display: none; flex-direction: column; align-items: center; gap: 6px;
  font-family: "Arial Narrow", "Roboto Condensed", Arial, sans-serif; text-transform: uppercase; }
.sc-label { font-size: 16px; letter-spacing: 8px; font-weight: 800; color: #e8edf5;
  text-shadow: 0 2px 12px #000; }
.sc-number { font-size: 200px; line-height: 1; font-weight: 1000; font-style: italic; color: #fff;
  text-shadow: 0 0 40px rgba(225,6,0,.9), 0 6px 24px #000; }
.sc-number.go { color: #19e676; text-shadow: 0 0 50px rgba(25,230,118,.9), 0 6px 24px #000; }
.sc-number.pop { animation: scPop 0.9s ease-out forwards; }
@keyframes scPop {
  0%   { transform: scale(1.7); opacity: 0; }
  20%  { transform: scale(1);   opacity: 1; }
  80%  { transform: scale(1);   opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.15; }
}
@media (max-width: 700px) { .sc-number { font-size: 120px; } }
`;

// Shows 3 - 2 - 1 while the start lights are building, then GO! for one second.
// Reads grid.count and grid.goAt, which Race.jsx sets.
export default function StartCountdown() {
  const root = useRef(null);
  const label = useRef(null);
  const number = useRef(null);
  const last = useRef("");

  useEffect(() => {
    let frame;

    const update = () => {
      frame = requestAnimationFrame(update);

      let text = "";

      if (grid.active && grid.count > 0) {
        text = String(grid.count);
      } else if (grid.go && grid.goAt && performance.now() - grid.goAt < 1000) {
        text = "GO!";
      }

      if (text === last.current) return;
      last.current = text;

      const node = number.current;
      if (!node || !root.current) return;

      root.current.style.display = text ? "flex" : "none";
      node.textContent = text;
      node.className = "sc-number" + (text === "GO!" ? " go" : "");

      if (text) {
        // restart the pop animation
        void node.offsetWidth;
        node.classList.add("pop");
      }

      if (label.current) {
        label.current.textContent = text === "GO!" ? "LIGHTS OUT" : "RACE STARTS IN";
      }
    };

    frame = requestAnimationFrame(update);

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="sc-wrap" ref={root}>
      <style>{css}</style>
      <div className="sc-label" ref={label} />
      <div className="sc-number" ref={number} />
    </div>
  );
}