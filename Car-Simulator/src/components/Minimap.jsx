import { useEffect, useRef } from "react";
import { curve } from "./trackCurve";
import { mapCars } from "./Racemap";

const SAMPLES = 500;
const PAD = 22;

const css = `
.mm-wrap {
  position: fixed;
  right: 24px;
  bottom: 70px;
  z-index: 99999;
  pointer-events: none;
  border: 2px solid rgba(225, 6, 0, .95);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(10, 14, 21, .97);
  box-shadow: 0 8px 28px rgba(0, 0, 0, .55);
  font-family: Arial, sans-serif;
  display: block;
  visibility: visible;
  opacity: 1;
}
.mm-title {
  display: flex;
  justify-content: space-between;
  padding: 9px 12px;
  background: #242b35;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1.5px;
  color: #fff;
}
.mm-title span:last-child { color: #aab2bd; font-weight: 700; }
.mm-canvas { display: block; }
`;

export default function MiniMap({ size = 220 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const pts = Array.from({ length: SAMPLES }, (_, i) => curve.getPointAt(i / SAMPLES));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }

    const span = Math.max(maxX - minX, maxZ - minZ) || 1;
    const scale = (size - PAD * 2) / span;
    const ox = (size - (maxX - minX) * scale) / 2 - minX * scale;
    const oz = (size - (maxZ - minZ) * scale) / 2 - minZ * scale;
    const toX = (x) => ox + x * scale;
    const toY = (z) => oz + z * scale;

    // Static circuit layer: draw once at device-pixel resolution.
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const lg = layer.getContext("2d");
    lg.scale(dpr, dpr);
    lg.lineJoin = "round";
    lg.lineCap = "round";

    const circuitPath = () => {
      lg.beginPath();
      pts.forEach((p, i) => {
        if (i === 0) lg.moveTo(toX(p.x), toY(p.z));
        else lg.lineTo(toX(p.x), toY(p.z));
      });
      lg.closePath();
    };

    circuitPath();
    lg.strokeStyle = "#05070b";
    lg.lineWidth = 12;
    lg.stroke();
    circuitPath();
    lg.strokeStyle = "#e6ebf2";
    lg.lineWidth = 8;
    lg.stroke();
    circuitPath();
    lg.strokeStyle = "#303947";
    lg.lineWidth = 4;
    lg.stroke();

    const drawTick = (t, color, length) => {
      const p = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t);
      const nx = -tangent.z;
      const ny = tangent.x;
      lg.strokeStyle = color;
      lg.lineWidth = 3;
      lg.beginPath();
      lg.moveTo(toX(p.x) - nx * length, toY(p.z) - ny * length);
      lg.lineTo(toX(p.x) + nx * length, toY(p.z) + ny * length);
      lg.stroke();
    };

    drawTick(1 / 3, "#ffd23f", 7);
    drawTick(2 / 3, "#3a8dff", 7);
    drawTick(0, "#e10600", 10);

    let frameId;
    let disposed = false;

    const draw = () => {
      if (disposed) return;
      frameId = requestAnimationFrame(draw);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(layer, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cars = mapCars.filter((car) => car && Number.isFinite(car.x) && Number.isFinite(car.z));
      const ordered = [...cars].sort((a, b) => Number(a.player) - Number(b.player));

      ordered.forEach((car) => {
        const x = toX(car.x);
        const y = toY(car.z);

        if (car.player) {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffd000";
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.fill();

          const hx = Math.sin(car.yaw || 0);
          const hy = Math.cos(car.yaw || 0);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + hx * 7, y + hy * 7);
          ctx.lineTo(x + hx * 15, y + hy * 15);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#05070b";
          ctx.beginPath();
          ctx.arc(x, y, 5.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = car.color || "#3671ff";
          ctx.beginPath();
          ctx.arc(x, y, 3.8, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
    };
  }, [size]);

  return (
    <div className="mm-wrap">
      <style>{css}</style>
      <div className="mm-title">
        <span>CIRCUIT MAP</span>
        <span>S1 · S2 · S3</span>
      </div>
      <canvas ref={canvasRef} className="mm-canvas" />
    </div>
  );
}
