import React, { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CompetitionScheduleCell from "../components/CompetitionScheduleCell";
import { scheduleColumnLabel } from "../utils/competitionSchedule";
import "./CompetitionsPage.css";

const PAGE_SIZE = 15;
const STATUS_TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "running", label: "Running" },
  { id: "done", label: "Done" },
];

const FORMAT_LABELS = {
  swiss: "Swiss",
  candidates: "Candidates",
  fifm: "FIFM",
};

function formatMode(mode) {
  return mode === "royale" ? "Royale" : "Standard";
}

function buildNotes(item) {
  const parts = [];
  parts.push(item.is_public ? "Public" : "Private");
  if (item.max_participants != null) parts.push(`Max ${item.max_participants} players`);
  if (item.min_rating != null) parts.push(`Min ${item.min_rating}`);
  if (item.max_rating != null) parts.push(`Max ${item.max_rating}`);
  if (item.format === "fifm" && item.duration_minutes != null) {
    parts.push(`${item.duration_minutes} min window`);
  }
  if (item.notes) parts.push(item.notes);
  return parts.length ? parts.join(" · ") : "—";
}

export default function CompetitionsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("upcoming");
  const [page, setPage] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadPage = useCallback(
    (nextStatus, pageOffset) => {
      setLoading(true);
      return api
        .getCompetitions({ status: nextStatus, offset: pageOffset, limit: PAGE_SIZE })
        .then((data) => {
          setPage(data);
          setOffset(data.offset);
        })
        .catch(() => setPage({ items: [], total: 0, offset: 0, limit: PAGE_SIZE }))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    loadPage(status, 0);
  }, [status, loadPage]);

  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.limit)) : 1;
  const currentPage = page ? Math.floor(page.offset / page.limit) + 1 : 1;
  const canPrev = page && page.offset > 0;
  const canNext = page && page.offset + page.limit < page.total;

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    setOffset(0);
  };

  const goPrev = () => {
    if (!canPrev) return;
    loadPage(status, Math.max(0, offset - PAGE_SIZE));
  };

  const goNext = () => {
    if (!canNext) return;
    loadPage(status, offset + PAGE_SIZE);
  };

  return (
    <div className="competitions-page">
      <div className="competitions-top">
        <div>
          <h1>Competitions</h1>
          <p className="competitions-desc">Browse upcoming, live, and past events</p>
        </div>
        <button
          type="button"
          className="competitions-create-btn"
          title="Create competition"
          aria-label="Create competition"
          onClick={() => navigate("/competitions/new")}
        >
          <span className="competitions-create-btn-glow" aria-hidden="true" />
          <span className="competitions-create-btn-ring" aria-hidden="true" />
          <Plus size={44} strokeWidth={2.25} />
        </button>
      </div>

      <div className="competitions-dock">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`dock-btn${status === tab.id ? " active" : ""}`}
            onClick={() => handleStatusChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="competitions-table">
        <div className="competitions-header-row">
          <span>Name</span>
          <span>Created by</span>
          <span>Mode</span>
          <span>Format</span>
          <span>{scheduleColumnLabel(status)}</span>
          <span>Notes</span>
        </div>

        {loading ? (
          <p className="competitions-empty">Loading…</p>
        ) : page?.items.length === 0 ? (
          <p className="competitions-empty">No {status} competitions yet.</p>
        ) : (
          page.items.map((item) => (
            <div
              className={`competitions-row competitions-row-clickable${
                item.is_joined ? " competitions-row-joined" : ""
              }`}
              key={item.id}
              onClick={() => navigate(`/competitions/${item.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/competitions/${item.id}`);
                }
              }}
            >
              <span className="comp-name-cell">
                {item.is_joined && <span className="comp-joined-pill">Joined</span>}
                <span className="comp-name">{item.name}</span>
              </span>
              <span className="comp-creator">{item.creator_username}</span>
              <span className={`comp-mode comp-mode-${item.game_mode}`}>
                {formatMode(item.game_mode)}
              </span>
              <span className="comp-format">{FORMAT_LABELS[item.format] || item.format}</span>
              <CompetitionScheduleCell item={item} tab={status} />
              <span className="comp-notes">{buildNotes(item)}</span>
            </div>
          ))
        )}
      </div>

      {!loading && page && page.total > 0 && (
        <div className="competitions-pagination">
          <button type="button" disabled={!canPrev} onClick={goPrev}>
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages} · {page.total} competitions
          </span>
          <button type="button" disabled={!canNext} onClick={goNext}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
