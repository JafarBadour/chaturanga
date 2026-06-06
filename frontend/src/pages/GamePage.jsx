import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ChessBoard from "../components/ChessBoard";
import GameClock from "../components/GameClock";
import GameSocialPanel from "../components/GameSocialPanel";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { api } from "../api/client";
import { playClockTick, playStrikeSword, shouldPlayClockTick, unlockGameAudio } from "../utils/gameSounds";
import {
  liveRoyaleClockDisplay,
  liveRoyaleMoveTimerMs,
  liveStandardClockMs,
  tryOptimisticMove,
} from "../utils/gameClock";
import "./GamePage.css";

function royaleLabel(timeControl) {
  const sec = timeControl.replace("royale/", "");
  return `Chess Royale · ${sec}s/move`;
}

function playerOutcome(game, color) {
  if (game.status !== "finished") return null;
  if (game.result === "draw") return "draw";
  return game.result === color ? "winner" : "loser";
}

/** Royale: only the active bar shows grace/move timer; opponent always waits. */
function royaleBarClock(royaleClock, barActive) {
  if (!barActive) {
    return { timeMs: 0, watching: false, royalePhase: null };
  }
  return {
    timeMs: royaleClock.ms,
    watching: false,
    royalePhase: royaleClock.phase,
  };
}

function useGameBoardSize() {
  function calc() {
    // subtract: sidebar (340px) + gap (24px) + page padding (48px)
    const maxW = window.innerWidth - 412;
    // subtract: top bar (48px) + two clocks (72px each) + player bars (32px) + padding (48px)
    const maxH = window.innerHeight - 272;
    return Math.max(320, Math.min(maxW, maxH, 900));
  }

  const [size, setSize] = useState(calc);

  useEffect(() => {
    function recalc() { setSize(calc()); }
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, []);

  return size;
}

export default function GamePage() {
  const { gameId } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const boardSize = useGameBoardSize();
  const [game, setGame] = useState(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [moveTimer, setMoveTimer] = useState(0);
  const [clockTick, setClockTick] = useState(0);
  const [strikeFlash, setStrikeFlash] = useState(null);
  const [boardShaking, setBoardShaking] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [incomingReaction, setIncomingReaction] = useState(null);
  const [incomingMessage, setIncomingMessage] = useState(null);
  const [chatError, setChatError] = useState(null);
  const [drawOffer, setDrawOffer] = useState(null);
  const joinedRef = useRef(false);
  const gameClockRef = useRef(null);
  const prevMovesRef = useRef("");
  const timeoutSentRef = useRef(false);
  const flagSentRef = useRef(false);
  const pendingMoveRef = useRef(false);
  const lastTickBucketRef = useRef(null);
  const activeColorRef = useRef("white");

  const applyClockState = useCallback((data) => {
    pendingMoveRef.current = false;
    const nextGame = data.game;
    gameClockRef.current = nextGame;
    setGame(nextGame);
    if (nextGame?.active_color) {
      activeColorRef.current = nextGame.active_color;
    }
    if (nextGame?.game_mode !== "royale") {
      const { whiteMs, blackMs } = liveStandardClockMs(nextGame);
      setWhiteTime(whiteMs);
      setBlackTime(blackMs);
    } else {
      setWhiteTime(nextGame?.white_time_ms ?? 0);
      setBlackTime(nextGame?.black_time_ms ?? 0);
    }
    if (nextGame?.game_mode === "royale") {
      setMoveTimer(liveRoyaleMoveTimerMs(nextGame));
      setClockTick((t) => t + 1);
      timeoutSentRef.current = false;
    } else {
      flagSentRef.current = false;
      if (data.move_timer_ms != null) {
        setMoveTimer(data.move_timer_ms);
      }
    }
    if (data.draw_offer !== undefined) {
      setDrawOffer(data.draw_offer);
    } else if (nextGame?.draw_offer) {
      setDrawOffer(nextGame.draw_offer);
    }
    if (nextGame?.status === "finished") {
      setDrawOffer(null);
    }
  }, []);

  const handleWsMessage = useCallback(
    (data) => {
      if (data.type === "game_state" || data.type === "game_update") {
        applyClockState(data);
      } else if (data.type === "strike") {
        applyClockState(data);
        if (data.strike_event) {
          setStrikeFlash(data.strike_event.color);
          setBoardShaking(true);
          playStrikeSword();
          setTimeout(() => {
            setStrikeFlash(null);
            setBoardShaking(false);
          }, 1200);
        }
      } else if (data.type === "game_over") {
        applyClockState(data);
        refreshUser();
      } else if (data.type === "move_error") {
        pendingMoveRef.current = false;
        if (data.game) {
          applyClockState(data);
        }
        setLastMove(null);
      } else if (data.type === "game_reaction" && data.game_id === gameId) {
        setIncomingReaction(data);
      } else if (data.type === "game_message" && data.game_id === gameId) {
        setIncomingMessage(data);
      } else if (data.type === "game_message_error" && data.game_id === gameId) {
        setChatError(data.message || "Could not send message");
      } else if (data.type === "draw_offered" && data.game_id === gameId) {
        setDrawOffer(data.draw_offer ?? null);
      } else if (data.type === "draw_declined" && data.game_id === gameId) {
        setDrawOffer(null);
      } else if (data.type === "draw_error" && data.game_id === gameId) {
        setChatError(data.message || "Draw offer failed");
      }
    },
    [applyClockState, refreshUser, gameId]
  );

  const { send, connected } = useWebSocket(handleWsMessage);

  useEffect(() => {
    api
      .getGame(gameId)
      .then((g) => {
        gameClockRef.current = g;
        setGame(g);
        setDrawOffer(g.draw_offer ?? null);
        activeColorRef.current = g.active_color ?? "white";
        if (g.game_mode === "royale") {
          setWhiteTime(g.white_time_ms);
          setBlackTime(g.black_time_ms);
          setMoveTimer(liveRoyaleMoveTimerMs(g));
          setClockTick((t) => t + 1);
        } else {
          const { whiteMs, blackMs } = liveStandardClockMs(g);
          setWhiteTime(whiteMs);
          setBlackTime(blackMs);
        }
      })
      .catch(() => navigate("/play"));
  }, [gameId, navigate]);

  useEffect(() => {
    if (!connected) {
      joinedRef.current = false;
    }
  }, [connected]);

  useEffect(() => {
    if (connected && gameId && !joinedRef.current) {
      joinedRef.current = true;
      send({ type: "join_game", game_id: gameId });
    }
  }, [connected, gameId, send]);

  useEffect(() => {
    if (!connected || !game?.competition_id) return;
    send({ type: "comp_cancel_seek", competition_id: game.competition_id });
  }, [connected, game?.competition_id, send]);

  useEffect(() => {
    const unlock = () => unlockGameAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const isRoyale = game?.game_mode === "royale";
  const royaleClock = useMemo(
    () =>
      isRoyale && game?.status === "active"
        ? liveRoyaleClockDisplay(game)
        : { phase: "idle", ms: 0 },
    [isRoyale, game, clockTick]
  );

  useEffect(() => {
    if (!game || game.status !== "active") return;

    if (isRoyale) {
      const tick = () => {
        const g = gameClockRef.current;
        if (!g || g.status !== "active" || g.game_mode !== "royale") return;
        setClockTick((t) => t + 1);
        const remaining = liveRoyaleMoveTimerMs(g);
        setMoveTimer(remaining);
        if (
          remaining <= 0 &&
          !timeoutSentRef.current &&
          joinedRef.current &&
          g.last_move_at
        ) {
          timeoutSentRef.current = true;
          send({ type: "move_timeout", game_id: gameId });
        }
      };
      tick();
      const interval = setInterval(tick, 100);
      return () => clearInterval(interval);
    }

    const tick = () => {
      const g = gameClockRef.current;
      if (!g || g.status !== "active" || g.game_mode === "royale") return;
      const { whiteMs, blackMs } = liveStandardClockMs(g);
      setWhiteTime(whiteMs);
      setBlackTime(blackMs);
      const activeMs = g.active_color === "white" ? whiteMs : blackMs;
      if (
        activeMs <= 0 &&
        !flagSentRef.current &&
        joinedRef.current &&
        g.last_move_at
      ) {
        flagSentRef.current = true;
        send({ type: "flag", game_id: gameId });
      }
    };
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [game?.status, game?.game_mode, gameId, isRoyale, send]);

  useEffect(() => {
    if (!game || game.status !== "active") {
      lastTickBucketRef.current = null;
      return;
    }

    const activeMs = isRoyale
      ? royaleClock.phase === "grace"
        ? royaleClock.ms
        : moveTimer
      : game.active_color === "white"
        ? whiteTime
        : blackTime;

    if (!shouldPlayClockTick(game.time_control, activeMs)) {
      lastTickBucketRef.current = null;
      return;
    }

    const tickBucket = Math.floor(activeMs / 100);
    if (lastTickBucketRef.current !== tickBucket) {
      lastTickBucketRef.current = tickBucket;
      playClockTick();
    }
  }, [game, isRoyale, moveTimer, whiteTime, blackTime, royaleClock.ms, royaleClock.phase]);

  useEffect(() => {
    if (!game?.moves) return;
    if (game.moves !== prevMovesRef.current) {
      prevMovesRef.current = game.moves;
      if (game.moves.trim()) {
        setLastMove(null);
      }
    }
  }, [game?.moves]);

  if (!game || !user) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading game...</p>
      </div>
    );
  }

  const isWhite = game.white_player.id === user.id;
  const isBlack = game.black_player.id === user.id;
  const orientation = isBlack ? "black" : "white";
  const isWhiteTurn = game.active_color === "white";
  const myTurn =
    game.status === "active" &&
    ((isWhite && isWhiteTurn) || (isBlack && !isWhiteTurn));

  const boardInteractive = myTurn && game.status === "active";

  const opponent = isWhite ? game.black_player : game.white_player;
  const myRating = isWhite ? game.white_rating_before : game.black_rating_before;
  const oppRating = isWhite ? game.black_rating_before : game.white_rating_before;

  const myStrikes = isWhite ? game.white_strikes : game.black_strikes;
  const oppStrikes = isWhite ? game.black_strikes : game.white_strikes;

  const handleMove = (moveResult) => {
    if (!myTurn || pendingMoveRef.current) return;

    const mover = isWhite ? "white" : "black";
    const optimistic = tryOptimisticMove(game, moveResult.from, moveResult.to, mover);
    if (!optimistic) return;

    pendingMoveRef.current = true;
    gameClockRef.current = optimistic.game;
    activeColorRef.current = optimistic.game.active_color;
    setGame(optimistic.game);

    if (isRoyale) {
      timeoutSentRef.current = false;
      setClockTick((t) => t + 1);
      setMoveTimer(liveRoyaleMoveTimerMs(optimistic.game));
    } else {
      const { whiteMs, blackMs } = liveStandardClockMs(optimistic.game);
      setWhiteTime(whiteMs);
      setBlackTime(blackMs);
    }

    send({
      type: "move",
      game_id: gameId,
      from: moveResult.from,
      to: moveResult.to,
    });
    setLastMove({ from: moveResult.from, to: moveResult.to });
  };

  const handleResign = () => {
    send({ type: "resign", game_id: gameId });
  };

  const handleOfferDraw = () => {
    send({ type: "offer_draw", game_id: gameId });
    setDrawOffer({ user_id: user.id, color: isWhite ? "white" : "black" });
  };

  const handleAcceptDraw = () => {
    send({ type: "accept_draw", game_id: gameId });
  };

  const handleDeclineDraw = () => {
    send({ type: "decline_draw", game_id: gameId });
    setDrawOffer(null);
  };

  const handleSendReaction = (reactionId) => {
    send({ type: "game_reaction", game_id: gameId, reaction_id: reactionId });
  };

  const handleSendMessage = (text) => {
    send({ type: "game_message", game_id: gameId, text });
  };

  const resultMessage = () => {
    if (game.status !== "finished") return null;
    const won =
      (game.result === "white" && isWhite) || (game.result === "black" && isBlack);
    const lost =
      (game.result === "white" && isBlack) || (game.result === "black" && isWhite);
    if (game.termination === "resignation") {
      if (won) return "You won — opponent resigned";
      if (lost) return "You resigned";
    }
    if (game.termination === "timeout") {
      if (game.result === "draw") return "Draw — insufficient material";
      if (won) return "You won on time";
      if (lost) return "You lost on time";
    }
    if (game.termination === "insufficient_material") return "Draw — insufficient material";
    if (game.termination === "agreement") return "Draw by agreement";
    if (game.result === "draw") {
      if (game.is_stalemate || game.termination === "stalemate") return "Draw by stalemate";
      return "Game drawn";
    }
    if (won) return "You won!";
    if (lost) return "You lost";
    return "Game over";
  };

  const terminationMessage = () => {
    if (game.status !== "finished" || !game.termination) return null;
    if (["resignation", "agreement", "insufficient_material"].includes(game.termination)) {
      return null;
    }
    if (game.termination === "timeout" && game.result === "draw") return null;
    return game.termination.replace(/_/g, " ");
  };

  const ratingChange = () => {
    if (game.status !== "finished") return null;
    const after = isWhite ? game.white_rating_after : game.black_rating_after;
    const before = isWhite ? game.white_rating_before : game.black_rating_before;
    if (after == null) return null;
    const delta = after - before;
    return delta >= 0 ? `+${delta}` : `${delta}`;
  };

  const opponentClockActive =
    game.status === "active" &&
    ((isWhite && !isWhiteTurn) || (isBlack && isWhiteTurn));

  const selfClockActive =
    game.status === "active" &&
    ((isWhite && isWhiteTurn) || (isBlack && !isWhiteTurn));

  const opponentColor = isWhite ? "black" : "white";
  const selfColor = isWhite ? "white" : "black";
  const opponentOutcome = playerOutcome(game, opponentColor);
  const selfOutcome = playerOutcome(game, selfColor);

  const opponentRoyale = isRoyale ? royaleBarClock(royaleClock, opponentClockActive) : null;
  const selfRoyale = isRoyale ? royaleBarClock(royaleClock, selfClockActive) : null;

  return (
    <div className="game-page">
      <div className="game-layout">
        <div className="game-board-area">
          <div className="player-bar opponent">
            <GameClock
              timeMs={
                isRoyale
                  ? opponentRoyale.timeMs
                  : isWhite
                    ? blackTime
                    : whiteTime
              }
              idleTimeMs={null}
              active={opponentClockActive}
              watching={isRoyale ? opponentRoyale.watching : false}
              royalePhase={isRoyale ? opponentRoyale.royalePhase : null}
              label={`${opponent.username} (${oppRating})`}
              royale={isRoyale}
              strikes={oppStrikes}
              gameOutcome={opponentOutcome}
            />
          </div>

          <div className={`board-wrapper${boardShaking ? " board-shaking" : ""}`}>
            {strikeFlash && (
              <div className={`strike-overlay strike-${strikeFlash}`}>
                <span className="strike-text">STRIKE!</span>
              </div>
            )}
            <ChessBoard
              fen={game.fen}
              orientation={orientation}
              size={boardSize}
              enableMoves={boardInteractive}
              serverControlled
              inCheck={game.in_check}
              checkedColor={game.in_check ? game.active_color : null}
              onMove={handleMove}
              lastMove={lastMove}
              turn={game.active_color}
              showPossibleMovesSide={boardInteractive ? (isWhite ? "white" : "black") : "both"}
            />
          </div>

          <div className="player-bar self">
            <GameClock
              timeMs={
                isRoyale
                  ? selfRoyale.timeMs
                  : isWhite
                    ? whiteTime
                    : blackTime
              }
              idleTimeMs={null}
              active={selfClockActive}
              watching={isRoyale ? selfRoyale.watching : false}
              royalePhase={isRoyale ? selfRoyale.royalePhase : null}
              label={`${user.username} (${myRating})`}
              royale={isRoyale}
              strikes={myStrikes}
              gameOutcome={selfOutcome}
            />
          </div>
        </div>

        <div className="game-sidebar">
          <div className="game-info-panel">
            <h3>
              {isRoyale ? royaleLabel(game.time_control) : `${game.time_control} rated`}
            </h3>
            {isRoyale && game.status === "active" && royaleClock.phase === "waiting" && (
              <p className="royale-hint royale-status-hint">Waiting for both players to join…</p>
            )}
            {isRoyale && game.status === "active" && royaleClock.phase === "grace" && (
              <p className="royale-hint royale-status-hint">
                Opening grace for {game.active_color === "white" ? "White" : "Black"} — move
                timer starts in {Math.ceil(royaleClock.ms / 1000)}s
              </p>
            )}
            {isRoyale && game.status === "active" && royaleClock.phase === "move" && (
              <p className="royale-hint">2 strikes = forfeit. Timer resets after each strike.</p>
            )}
            {game.status === "active" && game.in_check && !game.is_checkmate && (
              <p className="position-status check">
                {game.active_color === "white" ? "White" : "Black"} is in check
              </p>
            )}
            {game.status === "active" && (game.is_checkmate || game.is_stalemate) && (
              <p className="position-status ending">Game ending…</p>
            )}
            {game.status === "active" && !isRoyale && (
              <div className="draw-actions">
                {drawOffer && drawOffer.user_id !== user.id ? (
                  <>
                    <p className="draw-offer-text">{opponent.username} offers a draw</p>
                    <div className="draw-offer-btns">
                      <button type="button" className="draw-accept-btn" onClick={handleAcceptDraw}>
                        Accept
                      </button>
                      <button type="button" className="draw-decline-btn" onClick={handleDeclineDraw}>
                        Decline
                      </button>
                    </div>
                  </>
                ) : drawOffer && drawOffer.user_id === user.id ? (
                  <p className="draw-offer-sent">Draw offer sent…</p>
                ) : (
                  <button type="button" className="draw-offer-btn" onClick={handleOfferDraw}>
                    Offer draw
                  </button>
                )}
              </div>
            )}
            {game.status === "active" && (
              <button className="resign-btn" onClick={handleResign}>
                Resign
              </button>
            )}
            {game.status === "finished" && (
              <div className="game-result">
                <p className="result-text">{resultMessage()}</p>
                {ratingChange() && (
                  <p className="rating-change">{ratingChange()} rating</p>
                )}
                {terminationMessage() && (
                  <p className="termination">{terminationMessage()}</p>
                )}
                <button
                  className="play-again-btn"
                  onClick={() => {
                    if (game.competition_id) {
                      navigate(`/competitions/${game.competition_id}`);
                    } else {
                      navigate("/play");
                    }
                  }}
                >
                  {game.competition_id ? "Play again in competition" : "Play again"}
                </button>
              </div>
            )}
          </div>

          <div className="move-list">
            <h4>Moves</h4>
            <div className="moves-scroll">
              {game.moves
                ? game.moves.split(/\s+/).map((move, i) => (
                    <span key={i} className="move-token">
                      {i % 2 === 0 && (
                        <span className="move-num">{Math.floor(i / 2) + 1}.</span>
                      )}
                      {move}
                    </span>
                  ))
                : <span className="no-moves">Game started</span>}
            </div>
          </div>

          <GameSocialPanel
            userId={user.id}
            opponentName={opponent.username}
            onSendReaction={handleSendReaction}
            onSendMessage={handleSendMessage}
            incomingReaction={incomingReaction}
            incomingMessage={incomingMessage}
            chatError={chatError}
            onDismissChatError={(msg) => setChatError(msg ?? null)}
          />
        </div>
      </div>
    </div>
  );
}
