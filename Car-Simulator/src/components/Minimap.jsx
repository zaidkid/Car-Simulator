import { useEffect, useRef } from "react";
import { curve } from "./Trackcurve";
import { mapCars } from "./Racemap";

const SAMPLES = 500;
const PAD = 18;

const css = `
.mm-wrap {
  position: fixed;
  left: 70%;
  top: 64%;
  right: auto;
  bottom: auto;
  transform: translate(-50%, -50%);
  z-index: 99999;
  pointer-events: none;
  overflow: visible;
  font-family: Arial, sans-serif;
  display: block;
  visibility: visible;
  opacity: 1;
}
.mm-canvas { display: block; }
.mm-title { display: none; }
`;

export default function MiniMap({ size = 220 }) {
  const canvasRef = useRef(null);
  const width = Math.round(size * 1.28);
  const height = Math.round(size * 0.62);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const pts = Array.from({ length: SAMPLES }, (_, i) => curve.getPointAt(i / SAMPLES));
    const scale = Math.min((width - PAD * 2) / 1000, (height - PAD * 2) / 430);

    // Static circuit layer: draw once at device-pixel resolution.
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const lg = layer.getContext("2d");
    lg.scale(dpr, dpr);
    lg.lineJoin = "round";
    lg.lineCap = "round";

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
      const player = cars.find((car) => car.player) || cars[0] || { x: 0, z: 0, yaw: 0 };
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      pts.forEach((point, index) => {
        const dx = point.x - player.x;
        const dz = point.z - player.z;
        const distance = dx * dx + dz * dz;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });
      const tangent = curve.getTangentAt(nearestIndex / SAMPLES);
      const trackYaw = Math.atan2(tangent.x, tangent.z);
      const forwardX = Math.sin(trackYaw);
      const forwardZ = Math.cos(trackYaw);
      // Canvas X is mirrored relative to the track-side camera/map convention.
      const rightX = -Math.cos(trackYaw);
      const rightZ = Math.sin(trackYaw);
      const centerX = width / 2;
      const centerY = height * 0.62;
      const project = (x, z) => {
        const dx = x - player.x;
        const dz = z - player.z;
        return [
          centerX + (dx * rightX + dz * rightZ) * scale,
          centerY - (dx * forwardX + dz * forwardZ) * scale,
        ];
      };

      ctx.save();
      ctx.beginPath();
      ctx.rect(4, 4, width - 8, height - 8);
      ctx.clip();

      const circuitPath = () => {
        ctx.beginPath();
        pts.forEach((point, index) => {
          const [x, y] = project(point.x, point.z);
          if (index === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
      };

      circuitPath();
      ctx.strokeStyle = "rgba(0, 0, 0, .92)";
      ctx.lineWidth = 12;
      ctx.stroke();
      circuitPath();
      ctx.strokeStyle = "rgba(227, 240, 250, .96)";
      ctx.lineWidth = 7;
      ctx.stroke();
      circuitPath();
      ctx.strokeStyle = "#68798a";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const drawTick = (t, color, length) => {
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const [x, y] = project(point.x, point.z);
        const nx = -tangent.z;
        const ny = tangent.x;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - nx * length, y - ny * length);
        ctx.lineTo(x + nx * length, y + ny * length);
        ctx.stroke();
      };
      drawTick(1 / 3, "#ffb52e", 5);
      drawTick(2 / 3, "#43c9ff", 5);
      drawTick(0, "#ffffff", 8);

      const ordered = [...cars].sort((a, b) => Number(a.player) - Number(b.player));

      ordered.forEach((car) => {
        const [x, y] = car.player ? [centerX, centerY] : project(car.x, car.z);

        if (car.player) {
          const relativeYaw = (car.yaw || 0) - trackYaw;
          const hx = -Math.sin(relativeYaw);
          const hy = -Math.cos(relativeYaw);
          const px = -hy;
          const py = hx;
          ctx.save();
          ctx.shadowColor = "rgba(255, 50, 47, .95)";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#ff3436";
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x + hx * 10, y + hy * 10);
          ctx.lineTo(x - hx * 6 + px * 5.5, y - hy * 6 + py * 5.5);
          ctx.lineTo(x - hx * 6 - px * 5.5, y - hy * 6 - py * 5.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.fillStyle = "rgba(0, 0, 0, .8)";
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = car.color || "#3671ff";
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.restore();

      // Keep the player marker fixed while the route scrolls beneath it.
      ctx.save();
      ctx.shadowColor = "rgba(255, 196, 48, .85)";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "#ffd23f";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
    };
  }, [size, width, height]);

  return (
    <div className="mm-wrap">
      <style>{css}</style>
      <div className="mm-title">
        <span>LIVE TRACK</span>
        <span>S1 · S2 · S3</span>
      </div>
      <canvas ref={canvasRef} className="mm-canvas" />
    </div>
  );
}
