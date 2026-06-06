import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, Pencil } from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { formatCompDate, getScheduleLines, needsScheduleTick } from "../utils/competitionSchedule";
import SwissBracket from "../components/SwissBracket";
import "./CompetitionDetailPage.css";

const FORMAT_LABELS = { swiss: "Swiss", candidates: "Candidates", fifm: "FIFM" };

function formatMode(mode) {
  return mode === "royale" ? "Royale" : "Standard";
}

function formatTimeControl(tc, mode) {
  if (mode === "royale" && tc.startsWith("royale/")) {
    return `${tc.replace("royale/", "")}s / move`;
  }
  return tc;
}

function DetailScheduleBanner({ comp }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!needsScheduleTick(comp, comp.status)) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [comp.id, comp.starts_at, comp.ends_at, comp.format, comp.status]);

  const lines = getScheduleLines(comp, comp.status, now);

  return (
    <div className={`comp-detail-schedule comp-detail-schedule-${comp.status}`}>
      {lines.map((line) => (
        <span
          key={line}
          className={
            line.startsWith("Starts in ") || line.startsWith("Ends in ")
              ? "comp-detail-schedule-countdown"
              : undefined
          }
        >
          {line}
        </span>
      ))}
    </div>
  );
}

function CompPoolBanner({ format }) {
  const text =
    format === "fifm"
      ? "In the pool — matching you now"
      : "On the board — waiting for your pairing";
  return (
    <div className="comp-pool-banner" aria-live="polite">
      <div className="comp-pool-banner-glow" aria-hidden="true" />
      <div className="comp-pool-rings" aria-hidden="true">
        <span className="comp-pool-ring" />
        <span className="comp-pool-ring" />
        <span className="comp-pool-ring" />
      </div>
      <div className="comp-pool-banner-content">
        <span className="comp-pool-pulse-dot" />
        <p className="comp-pool-banner-text">{text}</p>
      </div>
    </div>
  );
}

function CompMatchOfferBanner({ match, onJoin, joining, connected, format, onExpired }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [match?.offer_id]);

  const expiresMs = new Date(match?.expires_at || 0).getTime();
  const remainingSec = Math.max(0, Math.ceil((expiresMs - now) / 1000));

  useEffect(() => {
    if (!match || remainingSec > 0) return undefined;
    const id = window.setTimeout(() => onExpired?.(), 400);
    return () => window.clearTimeout(id);
  }, [match, remainingSec, onExpired]);

  if (!match) return null;

  const offerFormat = match.format || format;
  const urgent = remainingSec <= 30 && remainingSec > 0;
  const timerLabel =
    remainingSec >= 60
      ? `${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s to join`
      : `${remainingSec}s to join`;
  const missedHint =
    offerFormat === "candidates"
      ? "Both players must join within 3 minutes — if neither joins, the pairing is a draw"
      : "Both players must join within 3 minutes — missed pairings are rematched with colors swapped";

  if (remainingSec <= 0) {
    if (offerFormat === "candidates") {
      return null;
    }
    return (
      <div className="comp-waiting-banner" aria-live="polite">
        <span className="comp-pool-pulse-dot" />
        <p>Pairing expired — rematching with colors swapped…</p>
      </div>
    );
  }

  return (
    <div className={`comp-match-offer${urgent ? " urgent" : ""}`} aria-live="polite">
      <div className="comp-match-offer-glow" aria-hidden="true" />
      <div className="comp-match-offer-content">
        <div className="comp-match-offer-head">
          <span className="comp-match-offer-badge">Your match</span>
          <span className={`comp-match-offer-timer${urgent ? " urgent" : ""}`}>
            {timerLabel}
          </span>
        </div>
        <p className="comp-match-offer-vs">
          vs <strong>{match.opponent_username}</strong>
        </p>
        <p className="comp-match-offer-hint">
          {match.you_joined && !match.opponent_joined
            ? "Waiting for opponent to join…"
            : match.you_joined && match.opponent_joined
              ? "Starting game…"
              : missedHint}
        </p>
        {!match.you_joined && (
          <button
            type="button"
            className="comp-match-join-btn"
            onClick={onJoin}
            disabled={!connected || joining || remainingSec <= 0}
          >
            {joining ? "Joining…" : "Join match"}
          </button>
        )}
        {match.you_joined && !match.opponent_joined && (
          <div className="comp-match-waiting">
            <span className="comp-pool-pulse-dot" />
            Ready — waiting for opponent
          </div>
        )}
      </div>
    </div>
  );
}

function CompInviteLinkPanel({ competitionId, inviteToken }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/competitions/${competitionId}?invite=${inviteToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="comp-invite-panel">
      <h2>Invite link</h2>
      <p className="comp-invite-hint">
        Share this link so others can view and join this private competition.
      </p>
      <div className="comp-invite-row">
        <input type="text" className="comp-invite-input" readOnly value={link} aria-label="Invite link" />
        <button type="button" className="comp-invite-copy" onClick={handleCopy}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}

export default function CompetitionDetailPage() {
  const { competitionId } = useParams();
  const location = useLocation();
  const inviteToken = new URLSearchParams(location.search).get("invite");
  const { user } = useAuth();
  const navigate = useNavigate();
  const poolOptOut = useRef(false);
  const [poolPaused, setPoolPaused] = useState(false);
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [pendingMatch, setPendingMatch] = useState(null);
  const [joiningMatch, setJoiningMatch] = useState(false);
  const [error, setError] = useState("");

  const normalizePendingMatch = useCallback((pm) => {
    if (!pm) return null;
    if (new Date(pm.expires_at).getTime() <= Date.now()) return null;
    return pm;
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    return api
      .getCompetition(competitionId, { invite: inviteToken })
      .then((data) => {
        setComp(data);
        setPendingMatch(normalizePendingMatch(data.pending_match));
      })
      .catch((err) => {
        setComp(null);
        setError(err.message || "Could not load competition");
      })
      .finally(() => setLoading(false));
  }, [competitionId, inviteToken, normalizePendingMatch]);

  const reloadQuiet = useCallback(() => {
    api.getCompetition(competitionId, { invite: inviteToken }).then((data) => {
      setComp(data);
      setPendingMatch(normalizePendingMatch(data.pending_match));
    }).catch(() => {});
  }, [competitionId, inviteToken, normalizePendingMatch]);

  const applyOfferPayload = useCallback((data) => {
    const expiresAt = data.expires_at_ms
      ? new Date(data.expires_at_ms).toISOString()
      : data.expires_at;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return;
    setPendingMatch({
      offer_id: data.offer_id,
      opponent_user_id: data.opponent_user_id,
      opponent_username: data.opponent_username,
      expires_at: expiresAt,
      you_joined: Boolean(data.you_joined),
      opponent_joined: Boolean(data.opponent_joined),
      format: data.format || null,
    });
  }, []);

  const handleOfferExpired = useCallback(() => {
    setPendingMatch(null);
    setJoiningMatch(false);
    reloadQuiet();
  }, [reloadQuiet]);

  const handleWsMessage = useCallback(
    (data) => {
      if (data.type === "matched" && data.competition_id === competitionId) {
        setSeeking(false);
        setPendingMatch(null);
        navigate(`/game/${data.game_id}`);
      } else if (data.type === "comp_seeking" && data.competition_id === competitionId) {
        setSeeking(true);
        setError("");
      } else if (data.type === "comp_seek_cancelled") {
        setSeeking(false);
      } else if (data.type === "comp_seek_error") {
        setSeeking(false);
        setError(data.message || "Could not enter pool");
      } else if (
        data.type === "comp_match_offer" &&
        data.competition_id === competitionId
      ) {
        applyOfferPayload({ ...data, you_joined: false, opponent_joined: false });
        setError("");
      } else if (
        data.type === "comp_match_offer_update" &&
        data.competition_id === competitionId
      ) {
        applyOfferPayload(data);
        setJoiningMatch(false);
      } else if (
        data.type === "comp_match_offer_expired" &&
        data.competition_id === competitionId
      ) {
        setPendingMatch((prev) =>
          prev?.offer_id === data.offer_id ? null : prev
        );
        setJoiningMatch(false);
        if (data.forfeit_draw || data.rematch) {
          reloadQuiet();
        }
      } else if (data.type === "comp_join_match_error") {
        setJoiningMatch(false);
        setError(data.message || "Could not join match");
      } else if (
        (data.type === "comp_refresh" ||
          data.type === "comp_pairing" ||
          data.type === "comp_match_scheduled") &&
        data.competition_id === competitionId
      ) {
        reloadQuiet();
      }
    },
    [competitionId, navigate, reloadQuiet, applyOfferPayload]
  );

  const { send, connected } = useWebSocket(handleWsMessage);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!connected || !competitionId) return undefined;
    send({ type: "comp_watch", competition_id: competitionId });
    return () => send({ type: "comp_unwatch", competition_id: competitionId });
  }, [connected, competitionId, send]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");
    try {
      const res = await api.joinCompetition(competitionId, { invite: inviteToken });
      setComp(res.competition);
    } catch (err) {
      setError(err.message || "Could not join");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    setError("");
    try {
      const updated = await api.leaveCompetition(competitionId, { invite: inviteToken });
      setComp(updated);
      setPendingMatch(null);
      setSeeking(false);
    } catch (err) {
      setError(err.message || "Could not leave");
    } finally {
      setLeaving(false);
    }
  };

  const pauseMatching = () => {
    poolOptOut.current = true;
    setPoolPaused(true);
    send({ type: "comp_cancel_seek", competition_id: competitionId });
    setSeeking(false);
  };

  const resumeMatching = () => {
    poolOptOut.current = false;
    setPoolPaused(false);
    send({ type: "comp_seek", competition_id: competitionId });
  };

  const handleJoinMatch = () => {
    if (!pendingMatch?.offer_id) return;
    setJoiningMatch(true);
    setError("");
    send({
      type: "comp_join_match",
      competition_id: competitionId,
      offer_id: pendingMatch.offer_id,
    });
  };

  const showMatchControls =
    comp?.status === "running" && comp?.is_joined && !comp?.viewer_in_game && !pendingMatch;

  useEffect(() => {
    poolOptOut.current = false;
    setPoolPaused(false);
  }, [competitionId]);

  useEffect(() => {
    if (!connected || !comp || comp.status !== "running" || !comp.is_joined) return undefined;
    if (poolOptOut.current || comp.viewer_in_game || pendingMatch) return undefined;

    send({ type: "comp_seek", competition_id: competitionId });

    return () => {
      send({ type: "comp_cancel_seek", competition_id: competitionId });
      setSeeking(false);
    };
  }, [
    connected,
    comp?.status,
    comp?.is_joined,
    comp?.viewer_in_game,
    pendingMatch,
    competitionId,
    send,
    comp,
  ]);

  if (loading) {
    return (
      <div className="comp-detail-page">
        <p className="comp-detail-loading">Loading…</p>
      </div>
    );
  }

  if (!comp) {
    return (
      <div className="comp-detail-page">
        <button type="button" className="comp-detail-back" onClick={() => navigate("/competitions")}>
          <ArrowLeft size={18} />
          Back
        </button>
        <p className="comp-detail-error">{error || "Competition not found"}</p>
      </div>
    );
  }

  return (
    <div className="comp-detail-page">
      <button type="button" className="comp-detail-back" onClick={() => navigate("/competitions")}>
        <ArrowLeft size={18} />
        Back to competitions
      </button>

      {inviteToken && !comp.is_public && comp.can_join && (
        <p className="comp-invite-welcome">You&apos;ve been invited to this private competition.</p>
      )}

      {comp.viewer_invite_token && (
        <CompInviteLinkPanel
          competitionId={comp.id}
          inviteToken={comp.viewer_invite_token}
        />
      )}

      <div className={`comp-detail-header${comp.is_joined ? " comp-detail-header-joined" : ""}`}>
        <div>
          <div className="comp-detail-title-row">
            <span className={`comp-detail-status status-${comp.status}`}>{comp.status}</span>
            {comp.is_joined && <span className="comp-joined-pill">Joined</span>}
          </div>
          <h1>{comp.name}</h1>
          <p className="comp-detail-meta">
            by {comp.creator_username} · {formatMode(comp.game_mode)} ·{" "}
            {FORMAT_LABELS[comp.format] || comp.format}
          </p>
          <DetailScheduleBanner comp={comp} />
        </div>

        <div className="comp-detail-actions">
          {comp.can_edit && (
            <button
              type="button"
              className="comp-edit-btn"
              onClick={() => navigate(`/competitions/${comp.id}/edit`)}
            >
              <Pencil size={16} />
              Edit
            </button>
          )}
          {showMatchControls && seeking && (
            <button
              type="button"
              className="comp-pool-btn seeking"
              onClick={pauseMatching}
              disabled={!connected}
            >
              Pause matching
            </button>
          )}
          {showMatchControls && !seeking && poolPaused && (
            <button
              type="button"
              className="comp-pool-btn"
              onClick={resumeMatching}
              disabled={!connected}
            >
              Resume matching
            </button>
          )}
          {comp.can_leave && (
            <button
              type="button"
              className="comp-leave-btn"
              onClick={handleLeave}
              disabled={leaving}
            >
              {leaving ? "Leaving…" : "Leave"}
            </button>
          )}
          {!comp.is_joined && comp.can_join ? (
            <button type="button" className="comp-join-btn" onClick={handleJoin} disabled={joining}>
              {joining ? "Joining…" : "Join competition"}
            </button>
          ) : !comp.is_joined ? (
            <span className="comp-join-blocked" title={comp.join_block_reason || undefined}>
              {comp.join_block_reason || "Cannot join"}
            </span>
          ) : null}
        </div>
      </div>

      {seeking && comp.status === "running" && comp.is_joined && (
        <CompPoolBanner format={comp.format} />
      )}

      {pendingMatch && comp.format !== "fifm" && (
        <CompMatchOfferBanner
          match={pendingMatch}
          onJoin={handleJoinMatch}
          joining={joiningMatch}
          connected={connected}
          format={comp.format}
          onExpired={handleOfferExpired}
        />
      )}

      {showMatchControls && !seeking && poolPaused && (
        <div className="comp-waiting-banner" aria-live="polite">
          <span className="comp-pool-pulse-dot" />
          <p>Matching paused — resume when you are ready</p>
        </div>
      )}

      {error && <p className="comp-detail-error">{error}</p>}

      <div className="comp-detail-grid">
        <section className="comp-detail-card comp-detail-card-wide">
          <h2>Details</h2>
          <dl className="comp-detail-dl">
            <div>
              <dt>Time control</dt>
              <dd>{formatTimeControl(comp.time_control, comp.game_mode)}</dd>
            </div>
            <div>
              <dt>{comp.status === "running" || comp.status === "done" ? "Started" : "Starts"}</dt>
              <dd>{formatCompDate(comp.starts_at, { withYear: true })}</dd>
            </div>
            {comp.ends_at && (
              <div>
                <dt>{comp.status === "done" ? "Ended" : "Ends"}</dt>
                <dd>{formatCompDate(comp.ends_at, { withYear: true })}</dd>
              </div>
            )}
            <div>
              <dt>Visibility</dt>
              <dd>{comp.is_public ? "Public" : "Private"}</dd>
            </div>
            <div>
              <dt>Participants</dt>
              <dd>
                {comp.participant_count}
                {comp.max_participants != null ? ` / ${comp.max_participants}` : ""}
              </dd>
            </div>
            {(comp.min_rating != null || comp.max_rating != null) && (
              <div>
                <dt>Rating range</dt>
                <dd>
                  {comp.min_rating ?? "Any"} – {comp.max_rating ?? "Any"}
                </dd>
              </div>
            )}
            {comp.viewer_rating != null && (
              <div>
                <dt>Your rating</dt>
                <dd>{comp.viewer_rating}</dd>
              </div>
            )}
            {comp.format === "fifm" && comp.duration_minutes != null && (
              <div>
                <dt>Event window</dt>
                <dd>{comp.duration_minutes} minutes</dd>
              </div>
            )}
          </dl>
          {comp.notes && <p className="comp-detail-notes">{comp.notes}</p>}
          {comp.format === "fifm" && comp.status === "running" && comp.is_joined && (
            <p className="comp-detail-fifm-hint">
              You are matched automatically while this page is open. Leave the page or pause
              matching to stop pairing.
            </p>
          )}
          {comp.format === "swiss" && comp.status === "running" && comp.is_joined && (
            <p className="comp-detail-scheduled-hint">
              Stay on this page to receive pairings. Join within 3 minutes — missed pairings
              are rematched with colors swapped.
            </p>
          )}
          {comp.format === "candidates" && comp.status === "running" && comp.is_joined && (
            <p className="comp-detail-scheduled-hint">
              Stay on this page to receive pairings. Join within 3 minutes — if neither player
              joins in time, the pairing counts as a draw.
            </p>
          )}
          {comp.format !== "fifm" && comp.status === "running" && !comp.is_joined && (
            <p className="comp-detail-lock-hint">
              Swiss and Candidates competitions lock registration once running.
            </p>
          )}
        </section>
      </div>

      <section className="comp-leaderboard-section">
        <div className="comp-leaderboard-head">
          <h2>Leaderboard</h2>
          {comp.is_joined && comp.viewer_rank != null && (
            <span className="comp-viewer-rank">
              Your rank: <strong>#{comp.viewer_rank}</strong>
            </span>
          )}
        </div>
        {comp.status === "upcoming" && comp.leaderboard.length > 0 && (
          <p className="comp-leaderboard-hint">
            Standings preview — ranked by rating until games begin.
          </p>
        )}
        {comp.leaderboard.length === 0 ? (
          <p className="comp-detail-empty">No players joined yet.</p>
        ) : (
          <div className="comp-leaderboard-table">
            <div className="comp-leaderboard-header">
              <span>#</span>
              <span>Player</span>
              <span>Rating</span>
              <span>Score</span>
              <span>W</span>
              <span>L</span>
              <span>D</span>
              <span>Games</span>
            </div>
            {comp.leaderboard.map((entry) => (
              <div
                key={entry.user_id}
                className={`comp-leaderboard-row${
                  user?.id === entry.user_id ? " highlight" : ""
                }`}
              >
                <span className="lb-rank">{entry.rank}</span>
                <span className="lb-name">{entry.username}</span>
                <span className="lb-rating">{entry.rating}</span>
                <span className="lb-score">{entry.score}</span>
                <span>{entry.wins}</span>
                <span>{entry.losses}</span>
                <span>{entry.draws}</span>
                <span>{entry.games_played}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {comp.format === "swiss" && comp.swiss_structure && (
        <SwissBracket structure={comp.swiss_structure} viewerUserId={user?.id} />
      )}
    </div>
  );
}
