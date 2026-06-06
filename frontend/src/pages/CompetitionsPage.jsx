import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CompetitionScheduleCell from "../components/CompetitionScheduleCell";
import { scheduleColumnLabel } from "../utils/competitionSchedule";
import { useDynamicPageSize } from "../hooks/useDynamicPageSize";
import "./CompetitionsPage.css";

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
  const bodyRef = useRef(null);
  const pageSize = useDynamicPageSize(bodyRef);
  const [status, setStatus] = useState("upcoming");
  const [page, setPage] = useState(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadPage = useCallback(
    (nextStatus, pageOffset, limit = pageSize) => {
      setLoading(true);
      return api
        .getCompetitions({ status: nextStatus, offset: pageOffset, limit })
        .then((data) => {
          setPage(data);
          setOffset(data.offset);
        })
        .catch(() => setPage({ items: [], total: 0, offset: 0, limit }))
        .finally(() => setLoading(false));
    },
    [pageSize]
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
    loadPage(status, Math.max(0, offset - pageSize));
  };

  const goNext = () => {
    if (!canNext) return;
    loadPage(status, offset + pageSize);
  };

  return (
    <div className="page-shell competitions-page">
      <div className="page-shell-head">
        <div>
          <h1>Competitions</h1>
          <p className="page-shell-desc">Browse upcoming, live, and past events</p>
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
          <Plus size={22} strokeWidth={2.25} />
        </button>
      </div>

      <div className="page-shell-toolbar competitions-dock">
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

      <div className="page-shell-body" ref={bodyRef}>
        <div className="data-table">
          <div className="competitions-header-row data-table-header">
            <span>Name</span>
            <span>Created by</span>
            <span>Mode</span>
            <span>Format</span>
            <span>{scheduleColumnLabel(status)}</span>
            <span>Notes</span>
          </div>

          {loading ? (
            <div className="data-table-loading">
              <div className="spinner" />
              <p>Loading competitions…</p>
            </div>
          ) : page?.items.length === 0 ? (
            <div className="data-table-empty">
              <p>No {status} competitions yet.</p>
            </div>
          ) : (
            <div className="data-table-scroll">
              {page.items.map((item) => (
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
              ))}
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
              <span className="page-foot-sub">{page.total} competitions</span>
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
