import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useWebSocket } from "../context/WebSocketContext";
import "./ChallengePage.css";

function formatClock(challenge) {
  if (challenge.game_mode === "royale" && challenge.time_control.startsWith("royale/")) {
    return `${challenge.time_control.replace("royale/", "")}s / move · Royale`;
  }
  return `${challenge.time_control} · Standard`;
}

export default function ChallengePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api
      .getChallenge(token)
      .then(setChallenge)
      .catch((err) => {
        setChallenge(null);
        setError(err.message || "Challenge not found");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWsMessage = useCallback(
    (data) => {
      if (data.type === "challenge_accepted" && data.token === token) {
        navigate(`/game/${data.game_id}`);
      }
    },
    [token, navigate]
  );

  useWebSocket(handleWsMessage);

  const handleAccept = async () => {
    setAccepting(true);
    setError("");
    try {
      const res = await api.acceptChallenge(token);
      navigate(`/game/${res.game_id}`);
    } catch (err) {
      setError(err.message || "Could not accept challenge");
      load();
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="challenge-page">
        <p className="challenge-page-loading">Loading challenge…</p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="challenge-page">
        <div className="challenge-card">
          <h1>Challenge unavailable</h1>
          <p>{error || "This link may have expired or already been used."}</p>
          <button type="button" onClick={() => navigate("/play")}>
            Back to play
          </button>
        </div>
      </div>
    );
  }

  if (challenge.game_id) {
    return (
      <div className="challenge-page">
        <div className="challenge-card">
          <h1>Challenge accepted</h1>
          <p>This game has already started.</p>
          <button type="button" onClick={() => navigate(`/game/${challenge.game_id}`)}>
            Open game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="challenge-page">
      <div className="challenge-card">
        <span className="challenge-card-badge">⚔️ Challenge</span>
        <h1>{challenge.creator_username} wants to play</h1>
        <p className="challenge-card-clock">{formatClock(challenge)}</p>

        {challenge.is_creator ? (
          <>
            <p className="challenge-card-hint">
              Share your challenge link and wait for someone to accept.
            </p>
            <button type="button" onClick={() => navigate("/play")}>
              Back to play
            </button>
          </>
        ) : challenge.can_accept ? (
          <>
            <p className="challenge-card-hint">Accept to start a rated game immediately.</p>
            {error && <p className="challenge-page-error">{error}</p>}
            <button
              type="button"
              className="challenge-accept-btn"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? "Starting…" : "Accept challenge"}
            </button>
          </>
        ) : (
          <>
            <p className="challenge-card-hint">
              {challenge.status === "expired"
                ? "This challenge has expired."
                : "This challenge is no longer available."}
            </p>
            <button type="button" onClick={() => navigate("/play")}>
              Back to play
            </button>
          </>
        )}
      </div>
    </div>
  );
}
