import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import RatingSpiderChart, { ROYALE_POOLS, STANDARD_POOLS } from "../components/RatingSpiderChart";
import "./ProfilePage.css";

const POOL_META = {
  blitz: { mode: "Standard", pool: "Blitz", label: "Standard Blitz" },
  rapid: { mode: "Standard", pool: "Rapid", label: "Standard Rapid" },
  classical: { mode: "Standard", pool: "Classical", label: "Standard Classical" },
  royale_bullet: { mode: "Royale", pool: "Bullet", label: "Royale Bullet" },
  royale_blitz: { mode: "Royale", pool: "Blitz", label: "Royale Blitz" },
  royale_rapid: { mode: "Royale", pool: "Rapid", label: "Royale Rapid" },
};

const ALL_POOLS = [...STANDARD_POOLS, ...ROYALE_POOLS];
const PAGE_SIZE = 15;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ratingDelta(before, after) {
  if (after == null || before == null) return "—";
  const d = after - before;
  return d >= 0 ? `+${d}` : `${d}`;
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState("standard");
  const [pool, setPool] = useState("blitz");
  const [history, setHistory] = useState({ items: [], total: 0, offset: 0, limit: PAGE_SIZE });
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    setPool(group === "royale" ? "royale_blitz" : "blitz");
  }, [group]);

  const loadHistory = useCallback(
    (offset = 0) => {
      setLoadingHistory(true);
      api
        .getGameHistory({ group, pool, offset, limit: PAGE_SIZE })
        .then((page) => setHistory(page))
        .catch(() => setHistory({ items: [], total: 0, offset: 0, limit: PAGE_SIZE }))
        .finally(() => setLoadingHistory(false));
    },
    [group, pool]
  );

  useEffect(() => {
    loadHistory(0);
  }, [loadHistory]);

  if (!user) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  const ratings = user.ratings || {};
  const tierPools = group === "royale" ? ROYALE_POOLS : STANDARD_POOLS;
  const pageCount = Math.max(1, Math.ceil(history.total / PAGE_SIZE));
  const currentPage = Math.floor(history.offset / PAGE_SIZE) + 1;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>{user.username}</h1>
        <p className="profile-meta">Member since {formatDate(user.created_at).split(",")[0]}</p>
      </div>

      <div className="profile-charts">
        <RatingSpiderChart ratings={ratings} />
      </div>

      <div className="ratings-table">
        <div className="ratings-header-row">
          <span>Pool</span>
          <span>Rating</span>
          <span>Games</span>
          <span>W</span>
          <span>L</span>
          <span>D</span>
        </div>
        {ALL_POOLS.map((p) => {
          const s = ratings[p.id] || {};
          const meta = POOL_META[p.id] || { mode: "", pool: p.label, label: p.label };
          return (
            <div className="ratings-row" key={p.id}>
              <span className="pool-cell">
                <span className="pool-mode">{meta.mode}</span>
                {meta.pool}
              </span>
              <span className="rating-cell">{s.rating ?? 1500}</span>
              <span className="num-cell">{s.games_played ?? 0}</span>
              <span className="num-cell">{s.wins ?? 0}</span>
              <span className="num-cell">{s.losses ?? 0}</span>
              <span className="num-cell">{s.draws ?? 0}</span>
            </div>
          );
        })}
      </div>

      <div className="profile-docks">
        <div className="dock-row">
          <button
            type="button"
            className={`dock-btn${group === "standard" ? " active" : ""}`}
            onClick={() => setGroup("standard")}
          >
            Standard
          </button>
          <button
            type="button"
            className={`dock-btn royale-active${group === "royale" ? " active" : ""}`}
            onClick={() => setGroup("royale")}
          >
            Royale
          </button>
        </div>
        <div className="dock-row">
          {tierPools.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`dock-btn${group === "royale" ? " royale-active" : ""}${
                pool === p.id ? " active" : ""
              }`}
              onClick={() => setPool(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="history-section">
        <h3>Game history · {POOL_META[pool]?.label || pool}</h3>
        {loadingHistory ? (
          <p className="history-empty">Loading…</p>
        ) : history.items.length === 0 ? (
          <p className="history-empty">No finished games in this pool yet.</p>
        ) : (
          <>
            <div className="history-table">
              <div className="history-header-row">
                <span>Date</span>
                <span>Opponent</span>
                <span>TC</span>
                <span>Result</span>
                <span>Δ</span>
              </div>
              {history.items.map((g) => (
                <div
                  key={g.id}
                  className="history-row"
                  onClick={() => navigate(`/review/${g.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigate(`/review/${g.id}`);
                    }
                  }}
                >
                  <span>{formatDate(g.finished_at)}</span>
                  <span>
                    {g.opponent_username} ({g.opponent_rating})
                  </span>
                  <span>{g.time_control}</span>
                  <span className={`outcome-${g.outcome}`}>{g.outcome}</span>
                  <span>{ratingDelta(g.my_rating_before, g.my_rating_after)}</span>
                </div>
              ))}
            </div>
            <div className="history-pagination">
              <button
                type="button"
                disabled={history.offset <= 0}
                onClick={() => loadHistory(Math.max(0, history.offset - PAGE_SIZE))}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {pageCount} · {history.total} games
              </span>
              <button
                type="button"
                disabled={history.offset + PAGE_SIZE >= history.total}
                onClick={() => loadHistory(history.offset + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
