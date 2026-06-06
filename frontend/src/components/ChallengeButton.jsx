import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy } from "lucide-react";
import { api } from "../api/client";
import { useWebSocket } from "../context/WebSocketContext";
import { toRoyaleTimeControl } from "../components/ChessRoyale";
import "./ChallengeButton.css";

const STANDARD_CONTROLS = ["3+0", "5+0", "10+0", "15+10"];
const ROYALE_SECONDS = ["3", "5", "11", "15"];

function formatChallengeClock(timeControl, gameMode) {
  if (gameMode === "royale" && timeControl.startsWith("royale/")) {
    return `${timeControl.replace("royale/", "")}s / move`;
  }
  return timeControl;
}

export default function ChallengeButton() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [gameMode, setGameMode] = useState("standard");
  const [timeControl, setTimeControl] = useState("5+0");
  const [recipient, setRecipient] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const handleWsMessage = useCallback(
    (data) => {
      if (data.type === "challenge_accepted" && created?.token === data.token) {
        setWaiting(false);
        setOpen(false);
        navigate(`/game/${data.game_id}`);
      } else if (data.type === "matched" && waiting) {
        setWaiting(false);
        setOpen(false);
        navigate(`/game/${data.game_id}`);
      }
    },
    [created?.token, waiting, navigate]
  );

  useWebSocket(handleWsMessage);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setError("");
      setCopied(false);
    }
  }, [open]);

  const fullLink = created
    ? `${window.location.origin}${created.link}`
    : "";

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    try {
      const tc =
        gameMode === "royale" ? toRoyaleTimeControl(timeControl.replace("royale/", "")) : timeControl;
      const res = await api.createChallenge({
        time_control: tc,
        game_mode: gameMode,
        recipient_username: recipient.trim() || undefined,
      });
      setCreated(res);
      setWaiting(true);
      setRecipient("");
    } catch (err) {
      setError(err.message || "Could not create challenge");
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const resetForm = () => {
    setCreated(null);
    setWaiting(false);
    setError("");
    setCopied(false);
  };

  const switchMode = (mode) => {
    setGameMode(mode);
    if (mode === "royale") {
      setTimeControl("5");
    } else {
      setTimeControl("5+0");
    }
  };

  return (
    <div className="challenge-btn-wrap" ref={panelRef}>
      <button
        type="button"
        className={`challenge-btn${open ? " open" : ""}${waiting ? " waiting" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="Challenge a friend"
        aria-expanded={open}
        title="Challenge a friend"
      >
        <span className="challenge-btn-icon" aria-hidden="true">
          ⚔️
        </span>
      </button>

      {open && (
        <div className="challenge-panel">
          <div className="challenge-panel-head">
            <h2>Challenge a friend</h2>
            <p>Pick a mode, create a link, and send it to your opponent.</p>
          </div>

          {!created ? (
            <>
              <div className="challenge-mode-tabs">
                <button
                  type="button"
                  className={gameMode === "standard" ? "active" : ""}
                  onClick={() => switchMode("standard")}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={gameMode === "royale" ? "active" : ""}
                  onClick={() => switchMode("royale")}
                >
                  Royale
                </button>
              </div>

              <div className="challenge-time-grid">
                {(gameMode === "royale" ? ROYALE_SECONDS : STANDARD_CONTROLS).map((tc) => {
                  const value = gameMode === "royale" ? tc : tc;
                  const selected =
                    gameMode === "royale"
                      ? timeControl === tc
                      : timeControl === tc;
                  return (
                    <button
                      key={tc}
                      type="button"
                      className={`challenge-time-btn${selected ? " selected" : ""}`}
                      onClick={() => setTimeControl(value)}
                    >
                      {gameMode === "royale" ? `${tc}s` : tc}
                    </button>
                  );
                })}
              </div>

              <label className="challenge-recipient">
                <span>Send to username (optional)</span>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Their username"
                  autoComplete="off"
                />
              </label>

              {error && <p className="challenge-error">{error}</p>}

              <button
                type="button"
                className="challenge-create-btn"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create challenge link"}
              </button>
            </>
          ) : (
            <div className="challenge-created">
              <p className="challenge-created-label">
                {formatChallengeClock(created.time_control, created.game_mode)} challenge ready
              </p>
              <div className="challenge-link-row">
                <input type="text" readOnly value={fullLink} aria-label="Challenge link" />
                <button type="button" className="challenge-copy-btn" onClick={handleCopy}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {waiting && (
                <p className="challenge-waiting">
                  <span className="challenge-wait-pulse" />
                  Waiting for opponent to accept…
                </p>
              )}
              {error && <p className="challenge-error">{error}</p>}
              <button type="button" className="challenge-new-btn" onClick={resetForm}>
                New challenge
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
