// =====================================================
// APEX RACING — LIVE CIRCUIT MAP DATA
// =====================================================
//
// Shared data between Race.jsx and Minimap.jsx.
//
// Index 0     = Player car
// Index 1–5   = AI opponents
//
// Race.jsx updates positions every frame.
// Minimap.jsx reads these positions to render cars.
//
// =====================================================

export const mapCars = [
  {
    color: "#ffd000",
    player: true,
    x: 0,
    z: 0,
    yaw: 0,
  },
  {
    color: "#3671ff",
    player: false,
    x: 0,
    z: 0,
    yaw: 0,
  },
  {
    color: "#e10600",
    player: false,
    x: 0,
    z: 0,
    yaw: 0,
  },
  {
    color: "#ff8700",
    player: false,
    x: 0,
    z: 0,
    yaw: 0,
  },
  {
    color: "#e10600",
    player: false,
    x: 0,
    z: 0,
    yaw: 0,
  },
  {
    color: "#00d2be",
    player: false,
    x: 0,
    z: 0,
    yaw: 0,
  },
];

// =====================================================
// UPDATE PLAYER POSITION
// =====================================================

export function updatePlayerMapPosition(x, z, yaw) {
  Object.assign(mapCars[0], {
    x,
    z,
    yaw,
  });
}

// =====================================================
// UPDATE AI CAR POSITION
// =====================================================

export function updateAIMapPosition(index, x, z, yaw) {
  const car = mapCars[index + 1];

  if (!car) return;

  Object.assign(car, {
    x,
    z,
    yaw,
  });
}

// =====================================================
// RESET ALL MAP POSITIONS
// =====================================================

export function resetMapPositions() {
  mapCars.forEach((car) => {
    car.x = 0;
    car.z = 0;
    car.yaw = 0;
  });
}