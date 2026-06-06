import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ChessBoard from "../components/ChessBoard";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import "./GameReviewPage.css";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const AUTO_PLAY_MS = 700;

function formatPlayedAt(iso) {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resultSummary(game, userId) {
  if (!game?.result) return "Game finished";
  const term = game.termination?.replace(/_/g, " ") || "checkmate";
  const isWhite = game.white_player.id === userId;
  const isBlack = game.black_player.id === userId;
  if (game.result === "draw") return `Draw · ${term}`;
  if (!isWhite && !isBlack) {
    const winner =
      game.result === "white" ? game.white_player.username : game.black_player.username;
    return `${winner} won · ${term}`;
  }
  const myColor = isWhite ? "white" : "black";
  if (game.result === myColor) return `You won · ${term}`;
  return `You lost · ${term}`;
}

export default function GameReviewPage() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [replay, setReplay] = useState(null);
  const [plyIndex, setPlyIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(null);

  useEffect(() => {
    api
      .getGameReplay(gameId)
      .then((data) => {
        setReplay(data);
        setPlyIndex(0);
      })
      .catch(() => navigate("/play"));
  }, [gameId, navigate]);

  const plies = replay?.plies?.length
    ? replay.plies
    : [{ ply: 0, fen: START_FEN, san: null, from_square: null, to_square: null }];
  const maxPly = plies.length - 1;
  const current = plies[plyIndex] || plies[0];
  const prevPly = plies[Math.max(0, plyIndex - 1)];

  const goTo = useCallback(
    (idx) => {
      setPlyIndex(Math.max(0, Math.min(maxPly, idx)));
    },
    [maxPly]
  );

  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (playRef.current) {
      clearInterval(playRef.current);
      playRef.current = null;
    }
  }, []);

  const togglePlay = () => {
    if (playing) {
      stopPlay();
      return;
    }
    if (plyIndex >= maxPly) {
      goTo(0);
    }
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return undefined;
    playRef.current = setInterval(() => {
      setPlyIndex((idx) => {
        if (idx >= maxPly) {
          stopPlay();
          return idx;
        }
        return idx + 1;
      });
    }, AUTO_PLAY_MS);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, maxPly, stopPlay]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") {
        stopPlay();
        goTo(plyIndex - 1);
      } else if (e.key === "ArrowRight") {
        stopPlay();
        goTo(plyIndex + 1);
      } else if (e.key === "Home") {
        stopPlay();
        goTo(0);
      } else if (e.key === "End") {
        stopPlay();
        goTo(maxPly);
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plyIndex, maxPly, goTo, stopPlay, playing]);

  if (!replay || !user) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading game…</p>
      </div>
    );
  }

  const isParticipant =
    replay.white_player.id === user.id || replay.black_player.id === user.id;
  const isWhite = replay.white_player.id === user.id;
  const orientation = isParticipant ? (isWhite ? "white" : "black") : "white";
  const lastMove =
    current.from_square && current.to_square
      ? { from: current.from_square, to: current.to_square }
      : prevPly?.from_square && prevPly?.to_square && plyIndex > 0
        ? { from: prevPly.from_square, to: prevPly.to_square }
        : null;

  const moveTokens = replay.moves
    ? replay.moves.split(/\s+/).filter((m) => m && m !== "…")
    : [];

  return (
    <div className="review-page">
      <Link to={isParticipant ? "/profile" : "/play"} className="review-back">
        ← {isParticipant ? "Back to profile" : "Back to play"}
      </Link>

      <div className="review-header">
        <h1>
          {replay.white_player.username} vs {replay.black_player.username}
        </h1>
        <p className="review-meta">
          Played <strong>{formatPlayedAt(replay.finished_at || replay.created_at)}</strong>
          <br />
          {replay.time_control} · {replay.rating_pool.replace(/_/g, " ")}
          <br />
          {resultSummary(replay, user.id)}
        </p>
      </div>

      <div className="review-layout">
        <div className="review-board-col">
          <ChessBoard
            fen={current.fen}
            orientation={orientation}
            size={480}
            enableMoves={false}
            lastMove={lastMove}
          />

          <div className="review-controls">
            <button type="button" title="Start" disabled={plyIndex <= 0} onClick={() => goTo(0)}>
              |◀
            </button>
            <button
              type="button"
              title="Previous"
              disabled={plyIndex <= 0}
              onClick={() => goTo(plyIndex - 1)}
            >
              ◀
            </button>
            <button
              type="button"
              className={`play-btn${playing ? " playing" : ""}`}
              onClick={togglePlay}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              title="Next"
              disabled={plyIndex >= maxPly}
              onClick={() => goTo(plyIndex + 1)}
            >
              ▶
            </button>
            <button
              type="button"
              title="End"
              disabled={plyIndex >= maxPly}
              onClick={() => goTo(maxPly)}
            >
              ▶|
            </button>
            <span className="review-ply-label">
              {plyIndex}/{maxPly}
            </span>
          </div>
        </div>

        <div className="review-sidebar">
          <div className="review-moves">
            <h4>Moves</h4>
            <div className="review-move-grid">
              <span
                className={`review-move-token${plyIndex === 0 ? " active" : ""}`}
                onClick={() => goTo(0)}
              >
                start
              </span>
              {moveTokens.map((san, i) => {
                const ply = i + 1;
                return (
                  <React.Fragment key={`${san}-${i}`}>
                    {i % 2 === 0 && (
                      <span className="review-move-num">{Math.floor(i / 2) + 1}.</span>
                    )}
                    <span
                      className={`review-move-token${plyIndex === ply ? " active" : ""}`}
                      onClick={() => goTo(ply)}
                    >
                      {san}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="review-result">
            White {replay.white_rating_before}
            {replay.white_rating_after != null && ` → ${replay.white_rating_after}`}
            <br />
            Black {replay.black_rating_before}
            {replay.black_rating_after != null && ` → ${replay.black_rating_after}`}
          </div>
        </div>
      </div>
    </div>
  );
}
