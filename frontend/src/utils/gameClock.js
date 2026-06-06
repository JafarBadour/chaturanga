import { ChessEngine } from "../components/chess/ChessEngine";

/** Per-side opening grace before the clock counts on a player's first turn. */
export const START_GRACE_MS = 10_000;

export function royaleMoveLimitMs(game) {
  if (game?.move_limit_ms) return game.move_limit_ms;
  const tc = game?.time_control ?? "";
  if (tc.startsWith("royale/")) {
    const sec = parseFloat(tc.replace("royale/", ""));
    if (!Number.isNaN(sec) && sec > 0) return Math.round(sec * 1000);
  }
  return 0;
}

/** Parse server UTC timestamps (naive ISO strings are treated as UTC). */
export function serverTimeMs(iso) {
  if (!iso) return null;
  if (typeof iso !== "string") {
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const normalized =
    iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = new Date(normalized).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function rawElapsedMs(game, nowMs = Date.now()) {
  const anchor = serverTimeMs(game?.last_move_at);
  if (anchor == null) return 0;
  return Math.max(0, nowMs - anchor);
}

export function isFirstTurn(game, color) {
  if (!game) return false;
  const moves = (game.moves || "").trim().split(/\s+/).filter(Boolean);
  if (color === "white") return moves.length === 0;
  return moves.length === 1;
}

export function billableElapsedMs(game, color, nowMs = Date.now()) {
  if (!game?.last_move_at) return 0;
  const raw = rawElapsedMs(game, nowMs);
  if (isFirstTurn(game, color)) {
    return Math.max(0, raw - START_GRACE_MS);
  }
  return raw;
}

/** Derive live standard clock display from server-stored times + last_move_at. */
export function liveStandardClockMs(game, nowMs = Date.now()) {
  if (!game) return { whiteMs: 0, blackMs: 0 };

  const whiteStored = game.white_time_ms ?? 0;
  const blackStored = game.black_time_ms ?? 0;

  if (game.status !== "active" || !game.last_move_at) {
    return { whiteMs: whiteStored, blackMs: blackStored };
  }

  if (game.active_color === "white") {
    const elapsed = billableElapsedMs(game, "white", nowMs);
    return {
      whiteMs: Math.max(0, whiteStored - elapsed),
      blackMs: blackStored,
    };
  }
  const elapsed = billableElapsedMs(game, "black", nowMs);
  return {
    whiteMs: whiteStored,
    blackMs: Math.max(0, blackStored - elapsed),
  };
}

export function liveRoyaleMoveTimerMs(game, nowMs = Date.now()) {
  const moveLimit = royaleMoveLimitMs(game);
  if (!moveLimit || game?.status !== "active") {
    return moveLimit;
  }
  if (!game.last_move_at) {
    return moveLimit;
  }
  const raw = rawElapsedMs(game, nowMs);
  if (isFirstTurn(game, game.active_color) && raw < START_GRACE_MS) {
    return moveLimit;
  }
  const billable = billableElapsedMs(game, game.active_color, nowMs);
  const remaining = Math.max(0, moveLimit - billable);
  if (!game.moves?.trim() && remaining === 0) {
    return moveLimit;
  }
  return remaining;
}

/** Shared royale clock display for both players (grace countdown, then move timer). */
export function liveRoyaleClockDisplay(game, nowMs = Date.now()) {
  const moveLimit = royaleMoveLimitMs(game);
  if (!moveLimit || game?.status !== "active") {
    return { phase: "idle", ms: moveLimit };
  }
  if (!game.last_move_at) {
    return { phase: "waiting", ms: moveLimit };
  }
  const raw = rawElapsedMs(game, nowMs);
  if (isFirstTurn(game, game.active_color) && raw < START_GRACE_MS) {
    return { phase: "grace", ms: START_GRACE_MS - raw };
  }
  const billable = billableElapsedMs(game, game.active_color, nowMs);
  const remaining = Math.max(0, moveLimit - billable);
  if (!game.moves?.trim() && remaining === 0) {
    return { phase: "waiting", ms: moveLimit };
  }
  return { phase: "move", ms: remaining };
}

/** Optimistic royale turn switch after sending a move (until server confirms). */
export function applyOptimisticRoyaleMove(game, color) {
  if (!game || game.game_mode !== "royale" || game.status !== "active") {
    return game;
  }
  const moves = (game.moves || "").trim();
  return {
    ...game,
    active_color: color === "white" ? "black" : "white",
    last_move_at: new Date().toISOString(),
    moves: moves ? `${moves} …` : "…",
  };
}

/** Optimistic local update after sending a standard move (Fischer increment). */
export function applyOptimisticMoveClock(game, color) {
  if (!game || game.game_mode === "royale" || game.status !== "active") {
    return game;
  }

  const elapsed = billableElapsedMs(game, color);
  const increment = game.increment_ms ?? 0;
  const nextColor = color === "white" ? "black" : "white";
  const nowIso = new Date().toISOString();
  const moves = (game.moves || "").trim();

  if (color === "white") {
    return {
      ...game,
      active_color: nextColor,
      last_move_at: nowIso,
      white_time_ms: Math.max(0, game.white_time_ms - elapsed) + increment,
      moves: moves ? `${moves} …` : "…",
    };
  }

  return {
    ...game,
    active_color: nextColor,
    last_move_at: nowIso,
    black_time_ms: Math.max(0, game.black_time_ms - elapsed) + increment,
    moves: moves ? `${moves} …` : "…",
  };
}

/**
 * Apply a move locally: update board + clocks immediately so RTT is not billed
 * to the mover and the opponent clock starts ticking right away.
 */
export function tryOptimisticMove(game, from, to, moverColor) {
  if (!game || game.status !== "active") return null;

  const engine = new ChessEngine(game.fen);
  const moverTurn = moverColor === "white" ? "w" : "b";
  if (engine.getTurn() !== moverTurn) return null;

  const legal = engine.getLegalMoves(from);
  if (!legal?.includes(to)) return null;

  engine.makeMove(from, to);
  const gs = engine.getGameState();

  let next =
    game.game_mode === "royale"
      ? applyOptimisticRoyaleMove(game, moverColor)
      : applyOptimisticMoveClock(game, moverColor);

  return {
    game: {
      ...next,
      fen: gs.fen,
      in_check: gs.inCheck,
      is_checkmate: gs.checkmate,
      is_stalemate: gs.stalemate,
    },
    from,
    to,
  };
}
