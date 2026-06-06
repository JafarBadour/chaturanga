import React from "react";

function formatMs(ms, royale = false) {
  if (royale) {
    const sec = Math.max(0, ms / 1000);
    if (sec < 10 && sec % 1 !== 0) {
      return sec.toFixed(1);
    }
    return Math.floor(sec).toString();
  }
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const OUTCOME_EMOJI = {
  winner: "👑",
  loser: "😢",
  draw: "🤝",
};

const OUTCOME_LABEL = {
  winner: "Winner",
  loser: "Lost",
  draw: "Draw",
};

function royalePhaseLabel(phase) {
  if (phase === "grace") return "grace";
  if (phase === "waiting") return "ready";
  return null;
}

function RoyaleTimer({ timeMs, low, phase, strikes, maxStrikes, watching = false }) {
  const phaseLabel = royalePhaseLabel(phase);
  return (
    <div className={`royale-timer${watching ? " royale-watching" : ""}${phase === "grace" ? " royale-grace" : ""}`}>
      <span className={`clock-time ${low ? "low" : ""} royale-time`}>
        {formatMs(timeMs, true)}
        <span className="clock-unit">s</span>
      </span>
      {phaseLabel && <span className="clock-phase">{phaseLabel}</span>}
      <div className="strike-pips" title={`${strikes} strike${strikes !== 1 ? "s" : ""}`}>
        {Array.from({ length: maxStrikes }).map((_, i) => (
          <span key={i} className={`strike-pip ${i < strikes ? "used" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export default function GameClock({
  timeMs,
  active,
  label,
  royale = false,
  strikes = 0,
  maxStrikes = 2,
  gameOutcome = null,
  idleTimeMs = null,
  watching = false,
  royalePhase = null,
}) {
  const low = royale ? timeMs < 3000 : timeMs < 30000;
  const showRoyaleWatch = royale && watching && !gameOutcome;
  const showIdle = royale && !active && !gameOutcome && !showRoyaleWatch;
  const idleLabel = idleTimeMs != null ? formatMs(idleTimeMs, royale) : formatMs(timeMs, royale);

  return (
    <div className={`game-clock ${active ? "active" : ""} ${royale ? "royale-clock" : "standard-clock"}`}>
      <span className="clock-label">{label}</span>
      <div className={`clock-display ${royale ? "royale-display" : "standard-display"}`}>
        {showIdle ? (
          <div className="clock-waiting" aria-label={`Waiting · ${idleLabel} remaining`}>
            <div className="waiting-dots" aria-hidden="true">
              <span className="waiting-dot" />
              <span className="waiting-dot" />
              <span className="waiting-dot" />
            </div>
            {royale && (
              <div className="strike-pips" title={`${strikes} strike${strikes !== 1 ? "s" : ""}`}>
                {Array.from({ length: maxStrikes }).map((_, i) => (
                  <span key={i} className={`strike-pip ${i < strikes ? "used" : ""}`} />
                ))}
              </div>
            )}
          </div>
        ) : gameOutcome ? (
          <div className="clock-game-result" aria-label={OUTCOME_LABEL[gameOutcome]}>
            <span className="result-emoji">{OUTCOME_EMOJI[gameOutcome]}</span>
          </div>
        ) : showRoyaleWatch ? (
          <RoyaleTimer
            timeMs={timeMs}
            low={low}
            phase={royalePhase}
            strikes={strikes}
            maxStrikes={maxStrikes}
            watching
          />
        ) : royale ? (
          <RoyaleTimer
            timeMs={timeMs}
            low={low}
            phase={royalePhase}
            strikes={strikes}
            maxStrikes={maxStrikes}
          />
        ) : (
          <span className={`clock-time ${low ? "low" : ""}`}>
            {formatMs(timeMs, royale)}
          </span>
        )}
      </div>
    </div>
  );
}
