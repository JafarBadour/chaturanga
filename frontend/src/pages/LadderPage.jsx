import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useDynamicPageSize } from "../hooks/useDynamicPageSize";
import "./LadderPage.css";

export default function LadderPage() {
  const { user } = useAuth();
  const bodyRef = useRef(null);
  const pageSize = useDynamicPageSize(bodyRef);
  const [pools, setPools] = useState([]);
  const [pool, setPool] = useState("blitz");
  const [page, setPage] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLadderPools().then(setPools).catch(() => {});
  }, []);

  const loadPage = useCallback(
    (selectedPool, pageOffset, anchor = null, limit = pageSize) => {
      setLoading(true);
      return api
        .getLadderPage(selectedPool, {
          offset: pageOffset,
          limit,
          anchor,
        })
        .then((data) => {
          setPage(data);
          setOffset(data.offset);
        })
        .finally(() => setLoading(false));
    },
    [pageSize]
  );

  useEffect(() => {
    loadPage(pool, 0, user ? "viewer" : null);
  }, [pool, user, loadPage]);

  const standardPools = pools.filter((p) => p.group === "standard");
  const royalePools = pools.filter((p) => p.group === "royale");

  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;
  const currentPage = page ? Math.floor(page.offset / page.limit) + 1 : 1;
  const canPrev = page && page.offset > 0;
  const canNext = page && page.offset + page.limit < page.total;

  const handlePoolChange = (nextPool) => {
    setPool(nextPool);
    setOffset(0);
  };

  const goPrev = () => {
    if (!canPrev) return;
    loadPage(pool, Math.max(0, offset - pageSize));
  };

  const goNext = () => {
    if (!canNext) return;
    loadPage(pool, offset + pageSize);
  };

  const jumpToMe = () => {
    loadPage(pool, 0, "viewer");
  };

  const viewer = page?.viewer;

  return (
    <div className="page-shell ladder-page">
      <div className="page-shell-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="page-shell-desc">Standard and Royale leaderboards by speed tier</p>
        </div>
      </div>

      <div className="page-shell-toolbar">
        <label className="ladder-sort">
          <span>Sort by</span>
          <select value={pool} onChange={(e) => handlePoolChange(e.target.value)}>
            {standardPools.length > 0 && (
              <optgroup label="Standard">
                {standardPools.map((p) => (
                  <option key={p.id} value={p.id} title={p.hint}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            )}
            {royalePools.length > 0 && (
              <optgroup label="Chess Royale">
                {royalePools.map((p) => (
                  <option key={p.id} value={p.id} title={p.hint}>
                    {p.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        {viewer && (
          <div className="ladder-viewer-chip">
            {viewer.rank ? (
              <>
                Your rank: <strong>#{viewer.rank}</strong>
                <span className="ladder-viewer-meta">
                  {viewer.rating} · {viewer.games_played} games
                </span>
              </>
            ) : (
              <span>No rated games in this pool yet</span>
            )}
            {viewer.rank && !viewer.on_page && (
              <button type="button" className="ladder-jump-btn" onClick={jumpToMe}>
                Jump to me
              </button>
            )}
          </div>
        )}
      </div>

      <div className="page-shell-body" ref={bodyRef}>
        <div className="data-table">
          <div className="ladder-header-row data-table-header">
            <span>#</span>
            <span>Player</span>
            <span>Rating</span>
            <span>Games</span>
            <span>W / L / D</span>
          </div>

          {loading ? (
            <div className="data-table-loading page-loading">
              <div className="spinner" />
              <p>Loading {page?.label || "leaderboard"}...</p>
            </div>
          ) : (
            <div className="data-table-scroll">
              {page?.entries.map((p) => (
                <div
                  key={p.id}
                  className={`ladder-row ${p.id === user?.id ? "highlight" : ""}`}
                >
                  <span className="rank">{p.rank}</span>
                  <span className="name">{p.username}</span>
                  <span className="rating">{p.rating}</span>
                  <span className="games">{p.games_played}</span>
                  <span className="record">
                    {p.wins} / {p.losses} / {p.draws}
                  </span>
                </div>
              ))}
              {page?.entries.length === 0 && (
                <p className="empty-ladder">
                  No rated games in {page.label} yet. Be the first to play!
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="page-shell-foot">
        <button type="button" disabled={!canPrev || loading} onClick={goPrev}>
          Previous
        </button>
        <span className="page-foot-info">
          {page && page.total > 0 ? (
            <>
              Page {currentPage} of {totalPages}
              <span className="page-foot-sub">{page.total} players</span>
            </>
          ) : null}
        </span>
        <button type="button" disabled={!canNext || loading} onClick={goNext}>
          Next
        </button>
      </div>
    </div>
  );
}
