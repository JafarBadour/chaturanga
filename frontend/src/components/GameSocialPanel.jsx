import React, { useCallback, useEffect, useRef, useState } from "react";
import { GAME_REACTIONS, REACTION_BY_ID } from "../constants/gameReactions";
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH,
  cooldownRemainingMs,
  validateChatMessage,
} from "../utils/chatLimits";
import "./GameSocialPanel.css";

const MUTE_REACTIONS_KEY = "chaturanga_mute_reactions";
const MUTE_CHAT_KEY = "chaturanga_mute_chat";

function readMute(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeMute(key, value) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function formatChatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GameSocialPanel({
  userId,
  opponentName,
  onSendReaction,
  onSendMessage,
  incomingReaction,
  incomingMessage,
  chatError,
  onDismissChatError,
}) {
  const [muteReactions, setMuteReactions] = useState(() => readMute(MUTE_REACTIONS_KEY));
  const [muteChat, setMuteChat] = useState(() => readMute(MUTE_CHAT_KEY));
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [bursts, setBursts] = useState([]);
  const [cooldownMs, setCooldownMs] = useState(0);
  const chatEndRef = useRef(null);
  const burstIdRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const sentTimestampsRef = useRef([]);
  const recentTextsRef = useRef([]);

  const pushBurst = useCallback((reaction, username, fromUserId) => {
    const def = REACTION_BY_ID[reaction.id];
    if (!def) return;
    const id = ++burstIdRef.current;
    setBursts((prev) => [
      ...prev,
      { id, emoji: def.emoji, anim: def.anim, username, fromUserId },
    ]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 2200);
  }, []);

  useEffect(() => {
    if (!incomingReaction || muteReactions) return;
    if (incomingReaction.user_id === userId) return;
    const def = REACTION_BY_ID[incomingReaction.reaction_id];
    if (!def) return;
    pushBurst(
      { id: incomingReaction.reaction_id },
      incomingReaction.username,
      incomingReaction.user_id
    );
  }, [incomingReaction, muteReactions, userId, pushBurst]);

  useEffect(() => {
    if (!incomingMessage || muteChat) return;
    if (incomingMessage.user_id === userId) return;
    setMessages((prev) => {
      const next = [...prev, incomingMessage];
      return next.length > MAX_CHAT_HISTORY ? next.slice(-MAX_CHAT_HISTORY) : next;
    });
  }, [incomingMessage, muteChat, userId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCooldownMs(cooldownRemainingMs(lastSentAtRef.current));
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const recordSend = (text) => {
    const now = Date.now();
    lastSentAtRef.current = now;
    sentTimestampsRef.current = [...sentTimestampsRef.current.filter((t) => now - t < 60_000), now];
    recentTextsRef.current = [...recentTextsRef.current, text].slice(-3);
    setCooldownMs(cooldownRemainingMs(now));
  };

  const toggleMuteReactions = () => {
    setMuteReactions((prev) => {
      const next = !prev;
      writeMute(MUTE_REACTIONS_KEY, next);
      return next;
    });
  };

  const toggleMuteChat = () => {
    setMuteChat((prev) => {
      const next = !prev;
      writeMute(MUTE_CHAT_KEY, next);
      return next;
    });
  };

  const handleReaction = (reactionId) => {
    const def = REACTION_BY_ID[reactionId];
    if (!def) return;
    onSendReaction(reactionId);
    pushBurst({ id: reactionId }, "You", userId);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onDismissChatError?.();

    const result = validateChatMessage(draft, {
      lastSentAt: lastSentAtRef.current,
      sentTimestamps: sentTimestampsRef.current,
      recentTexts: recentTextsRef.current,
    });
    if (!result.ok) {
      onDismissChatError?.(result.error);
      return;
    }

    const text = result.text;
    onSendMessage(text);
    recordSend(text);
    setMessages((prev) => {
      const next = [
        ...prev,
        {
          user_id: userId,
          username: "You",
          text,
          at: new Date().toISOString(),
          self: true,
        },
      ];
      return next.length > MAX_CHAT_HISTORY ? next.slice(-MAX_CHAT_HISTORY) : next;
    });
    setDraft("");
  };

  const handleDraftChange = (e) => {
    onDismissChatError?.();
    setDraft(e.target.value.slice(0, MAX_CHAT_LENGTH));
  };

  const sendDisabled = !draft.trim() || cooldownMs > 0;
  const charCount = draft.length;

  return (
    <div className="game-social-panel">
      <div className="social-section reactions-section">
        <div className="social-section-head">
          <h4>Reactions</h4>
          <button
            type="button"
            className={`social-mute-btn${muteReactions ? " muted" : ""}`}
            onClick={toggleMuteReactions}
            title={muteReactions ? "Unmute reactions" : "Mute reactions"}
            aria-pressed={muteReactions}
          >
            {muteReactions ? "🔇" : "🔊"}
          </button>
        </div>

        {muteReactions && (
          <p className="social-muted-note">Incoming reactions muted</p>
        )}

        {bursts.length > 0 && (
          <div className="reaction-burst-stage" aria-live="polite">
            {bursts.map((b) => (
              <div
                key={b.id}
                className={`reaction-burst ${b.anim}${b.fromUserId === userId ? " self-burst" : ""}`}
              >
                <span className="burst-emoji">{b.emoji}</span>
                <span className="burst-user">
                  {b.fromUserId === userId ? "You" : b.username || opponentName}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="reaction-picker">
          {GAME_REACTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`reaction-btn ${r.anim}`}
              title={r.label}
              onClick={() => handleReaction(r.id)}
            >
              <span className="reaction-emoji">{r.emoji}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="social-section chat-section">
        <div className="social-section-head">
          <h4>Messages</h4>
          <button
            type="button"
            className={`social-mute-btn${muteChat ? " muted" : ""}`}
            onClick={toggleMuteChat}
            title={muteChat ? "Unmute messages" : "Mute messages"}
            aria-pressed={muteChat}
          >
            {muteChat ? "🔇" : "🔊"}
          </button>
        </div>

        {muteChat ? (
          <p className="social-muted-note">Incoming messages muted</p>
        ) : (
          <div className="chat-scroll">
            {messages.length === 0 ? (
              <p className="chat-empty">Say hi to {opponentName}</p>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={`${msg.at}-${i}`}
                  className={`chat-line${msg.self ? " self" : ""}`}
                >
                  <span className="chat-meta">
                    <span className="chat-author">{msg.username}</span>
                    <span className="chat-time">{formatChatTime(msg.at)}</span>
                  </span>
                  <span className="chat-text">{msg.text}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
        )}
        {chatError && (
          <p className="chat-error" role="alert">
            {chatError}
          </p>
        )}
        <form className="chat-form" onSubmit={handleSubmit}>
          <div className="chat-input-wrap">
            <input
              type="text"
              className="chat-input"
              placeholder={
                cooldownMs > 0
                  ? `Wait ${Math.ceil(cooldownMs / 1000)}s…`
                  : muteChat
                    ? "Send (incoming muted)…"
                    : "Message…"
              }
              maxLength={MAX_CHAT_LENGTH}
              value={draft}
              onChange={handleDraftChange}
              disabled={cooldownMs > 0}
            />
            <span className={`chat-char-count${charCount >= MAX_CHAT_LENGTH - 20 ? " near-limit" : ""}`}>
              {charCount}/{MAX_CHAT_LENGTH}
            </span>
          </div>
          <button type="submit" className="chat-send" disabled={sendDisabled}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
