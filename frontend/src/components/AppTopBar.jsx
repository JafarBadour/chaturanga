import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import ChallengeButton from "./ChallengeButton";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import "./AppTopBar.css";

function ActiveGamesIndicator() {
  const { activeGames: games } = useWebSocket();
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const btnRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (games.length === 0) return null;

  return (
    <div className="ag-wrap">
      <button
        ref={btnRef}
        type="button"
        className={`ag-btn${open ? " open" : ""}`}
        title="Active games"
        onClick={() => setOpen((o) => !o)}
      >
        <Swords size={18} />
        <span className="ag-count">{games.length}</span>
        <span className="ag-pulse-dot" />
      </button>

      {open && (
        <div ref={popoverRef} className="ag-popover">
          <p className="ag-popover-title">Active games</p>
          {games.map((g) => (
            <button
              key={g.game_id}
              type="button"
              className="ag-row"
              onClick={() => { setOpen(false); navigate(`/game/${g.game_id}`); }}
            >
              <span className="ag-row-dot" />
              <span className="ag-row-info">
                <span className="ag-row-opponent">{g.opponent_username}</span>
                <span className="ag-row-meta">
                  {g.game_mode === "royale"
                    ? `Royale · ${g.time_control.replace("royale/", "")}s`
                    : g.time_control}
                  {" · "}{g.my_color === "white" ? "⬜" : "⬛"}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppTopBar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <header className="app-topbar">
      <div className="app-topbar-actions">
        <ActiveGamesIndicator />
        <ChallengeButton />
        <NotificationBell />
      </div>
    </header>
  );
}
