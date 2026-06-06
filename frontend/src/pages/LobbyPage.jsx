import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import ChessGrid from "../components/ChessGrid";
import ChessRoyale from "../components/ChessRoyale";
import "./LobbyPage.css";

export default function LobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  return (
    <div className="lobby-page">
      <div className="lobby-header">
        <h1>Play</h1>
        <div className="player-info">
          <span className="player-name">{user?.username}</span>
          <span className="player-rating">Blitz {user?.ratings?.blitz?.rating ?? user?.rating}</span>
        </div>
      </div>

      <div className="lobby-content">
        <div className="lobby-panels-stack">
          <div className="lobby-panel royale-panel">
            <h2>Chess Royale</h2>
            <p className="lobby-desc">
              Per-move timer. Miss twice and you forfeit. Both players must pick the same tier.
            </p>

            <div className="pairing-grid-wrap">
              <ChessRoyale seekingMode={seekingMode} onSelect={handlePlay} />
            </div>
          </div>

          <div className="lobby-panel">
            <h2>Quick pairing</h2>
            <p className="lobby-desc">
              Classic time controls with increment. Both players must pick the same clock.
            </p>

            <div className="pairing-grid-wrap">
              <ChessGrid seekingMode={seekingMode} onSelect={handlePlay} />
            </div>
          </div>

          {!connected && (
            <p className="connection-warning">Connecting to server...</p>
          )}
          {seekError && (
            <p className="connection-warning seek-error">{seekError}</p>
          )}
        </div>

        <div className="lobby-stats">
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
        </div>
      </div>
    </div>
  );
}
