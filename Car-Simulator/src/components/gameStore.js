import { useSyncExternalStore } from "react";

const START_TIME = 300;
const BEST_KEY = "apex-racing-best";

const loadBest = () => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

// Driver information
export const DRIVERS = [
  {
    id: "player",
    code: "YOU",
    name: "PLAYER",
    team: "APEX RACING",
    color: "#ffd000",
  },
  {
    id: "ai-0",
    code: "VER",
    name: "VERSTAPPEN",
    team: "RED BULL",
    color: "#3671ff",
  },
  {
    id: "ai-1",
    code: "HAM",
    name: "HAMILTON",
    team: "FERRARI",
    color: "#e10600",
  },
  {
    id: "ai-2",
    code: "NOR",
    name: "NORRIS",
    team: "MCLAREN",
    color: "#ff8700",
  },
  {
    id: "ai-3",
    code: "LEC",
    name: "LECLERC",
    team: "FERRARI",
    color: "#e10600",
  },
  {
    id: "ai-4",
    code: "RUS",
    name: "RUSSELL",
    team: "MERCEDES",
    color: "#00d2be",
  },
];

export const createInitialLeaderboard = () =>
  DRIVERS.map((driver, index) => ({
    ...driver,
    position: index + 1,
    gap: index === 0 ? "LEADER" : "—",
    progress: 0,
    speed: 0,
  }));

let state = {
  phase: "ready",
  score: 0,
  time: START_TIME,
  best: loadBest(),
  crashes: 0,
  leaderboard: createInitialLeaderboard(),
};

let timeLeft = START_TIME;

const listeners = new Set();

function publish(patch) {
  state = {
    ...state,
    ...patch,
  };

  listeners.forEach((listener) => listener());
}

export const game = {
  get: () => state,

  subscribe: (listener) => {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },

  start() {
    timeLeft = START_TIME;

    publish({
      phase: "playing",
      score: 0,
      time: START_TIME,
      crashes: 0,
      leaderboard: createInitialLeaderboard(),
    });
  },

  addScore(amount) {
    if (state.phase !== "playing") return;

    publish({
      score: state.score + amount,
    });
  },

  addTime(seconds) {
    if (state.phase !== "playing") return;

    timeLeft += seconds;

    publish({
      time: Math.ceil(timeLeft),
    });
  },

  crash() {
    if (state.phase !== "playing") return;

    timeLeft -= 2;

    if (timeLeft <= 0) {
      this.end();
      return;
    }

    publish({
      crashes: state.crashes + 1,
      time: Math.ceil(timeLeft),
    });
  },

  setLeaderboard(leaderboard) {
    if (state.phase !== "playing") return;

    publish({
      leaderboard,
    });
  },

  tick(delta) {
    if (state.phase !== "playing") return;

    timeLeft -= delta;

    if (timeLeft <= 0) {
      this.end();
      return;
    }

    const remaining = Math.ceil(timeLeft);

    if (remaining !== state.time) {
      publish({
        time: remaining,
      });
    }
  },

  end() {
    if (state.phase !== "playing") return;

    const best = Math.max(state.best, state.score);

    try {
      localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Storage unavailable
    }

    publish({
      phase: "over",
      time: 0,
      best,
    });
  },
};

export const useGame = () =>
  useSyncExternalStore(
    game.subscribe,
    game.get,
    game.get
  );