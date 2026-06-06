import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import PlayPairingGrid from "../components/PlayPairingGrid";
import "./LobbyPage.css";

const MODES = {
  royale: {
    id: "royale",
    label: "Chess Royale",
    desc: "Per-move timer — miss twice and you forfeit. Pick the same tier as your opponent.",
  },
  standard: {
    id: "standard",
    label: "Standard",
    desc: "Classic chess with increment clocks.",
  },
};

export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gameMode, setGameMode] = useState("royale");
  const [seekingMode, setSeekingMode] = useState(null);
  const [seekError, setSeekError] = useState("");

  const handleWsMessage = useCallback(
    (data) => {
      if (data.type === "matched") {
        setSeekingMode(null);
        setSeekError("");
        navigate(`/game/${data.game_id}`);
      } else if (data.type === "seeking") {
        setSeekingMode(data.time_control);
        setSeekError("");
      } else if (data.type === "seek_cancelled") {
        setSeekingMode(null);
        setSeekError("");
      } else if (data.type === "seek_error") {
        setSeekingMode(null);
        setSeekError(data.message || "Could not join queue");
      }
    },
    [navigate]
  );

  const { send, connected } = useWebSocket(handleWsMessage);

  useEffect(() => {
    if (!seekingMode) return;
    setGameMode(seekingMode.startsWith("royale/") ? "royale" : "standard");
  }, [seekingMode]);

  const handlePlay = (tc) => {
    if (seekingMode === tc) {
      send({ type: "cancel_seek" });
      setSeekingMode(null);
      setSeekError("");
      return;
    }

    setSeekError("");
    setSeekingMode(tc);
    send({ type: "seek", time_control: tc });
  };

  const activeMode = MODES[gameMode];

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <div>
          <h1>Play</h1>
          <p className="lobby-welcome">
            {user?.username} · Blitz {user?.ratings?.blitz?.rating ?? user?.rating ?? 1500}
          </p>
        </div>
      </div>

      {!connected && <p className="connection-warning">Connecting to server…</p>}
      {seekError && <p className="connection-warning seek-error">{seekError}</p>}

      <div className="lobby-layout">
        <div className="lobby-main">
          <div className="lobby-play-card">
            <div className="lobby-mode-dock" role="tablist" aria-label="Game mode">
              {Object.values(MODES).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  id={`lobby-tab-${mode.id}`}
                  aria-selected={gameMode === mode.id}
                  aria-controls={`lobby-panel-${mode.id}`}
                  className={`lobby-mode-tab${gameMode === mode.id ? " active" : ""}${
                    mode.id === "royale" ? " royale-tab" : ""
                  }`}
                  onClick={() => setGameMode(mode.id)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div
              className="lobby-mode-panel"
              role="tabpanel"
              id={`lobby-panel-${gameMode}`}
              aria-labelledby={`lobby-tab-${gameMode}`}
            >
              <p className="lobby-mode-desc">{activeMode.desc}</p>
              <PlayPairingGrid mode={gameMode} seekingMode={seekingMode} onSelect={handlePlay} />
            </div>
          </div>
        </div>

        <aside className="lobby-stats">
          <h3>Your ratings</h3>
          <div className="rating-pools-grid">
            {[
              { key: "blitz", label: "Std Blitz" },
              { key: "rapid", label: "Std Rapid" },
              { key: "classical", label: "Std Classical" },
              { key: "royale_bullet", label: "Royale Bullet" },
              { key: "royale_blitz", label: "Royale Blitz" },
              { key: "royale_rapid", label: "Royale Rapid" },
            ].map(({ key, label }) => {
              const stats = user?.ratings?.[key];
              if (!stats || stats.games_played === 0) return null;
              return (
                <div key={key} className="rating-pool-stat">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{stats.rating}</span>
                  <span className="stat-sub">{stats.games_played} games</span>
                </div>
              );
            })}
            {(!user?.ratings ||
              !Object.values(user.ratings).some((s) => s?.games_played > 0)) && (
              <p className="lobby-no-ratings">Play a rated game to appear on the ladder.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
