import React, { useCallback, useEffect, useRef, useState } from "react";
import { GAME_REACTIONS, REACTION_BY_ID } from "../constants/gameReactions";
import {
  MAX_CHAT_HISTORY,
  MAX_CHAT_LENGTH,
  cooldownRemainingMs,
  validateChatMessage,
} from "../utils/chatLimits";
import "./GameSocialPanel.css";

const MUTE_KEY = "chaturanga_mute_chat";

function readMute() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMute(value) {
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function formatChatTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isEmojiOnly(text) {
  // Single emoji reaction — no letters/digits/punctuation
  return /^\p{Emoji_Presentation}$/u.test(text.trim());
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
  pingMs = null,
}) {
  const [mute, setMute] = useState(() => readMute());
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [bursts, setBursts] = useState([]);
  const chatEndRef = useRef(null);
  const pickerRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const burstIdRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const sentTimestampsRef = useRef([]);
  const recentTextsRef = useRef([]);

  // Incoming chat messages
  useEffect(() => {
    if (!incomingMessage || mute) return;
    if (incomingMessage.user_id === userId) return;
    setMessages((prev) => {
      const next = [...prev, incomingMessage];
      return next.length > MAX_CHAT_HISTORY ? next.slice(-MAX_CHAT_HISTORY) : next;
    });
  }, [incomingMessage, mute, userId]);

  const pushBurst = useCallback((emoji, fromSelf) => {
    const id = ++burstIdRef.current;
    setBursts((prev) => [...prev, { id, emoji, fromSelf }]);
    window.setTimeout(() => {
      setBursts((prev) => prev.filter((b) => b.id !== id));
    }, 2200);
  }, []);

  // Incoming reactions → burst animation + emoji message in chat
  useEffect(() => {
    if (!incomingReaction || mute) return;
    if (incomingReaction.user_id === userId) return;
    const def = REACTION_BY_ID[incomingReaction.reaction_id];
    if (!def) return;
    pushBurst(def.emoji, false);
    setMessages((prev) => {
      const next = [
        ...prev,
        {
          user_id: incomingReaction.user_id,
          username: incomingReaction.username,
          text: def.emoji,
          at: incomingReaction.at || new Date().toISOString(),
        },
      ];
      return next.length > MAX_CHAT_HISTORY ? next.slice(-MAX_CHAT_HISTORY) : next;
    });
  }, [incomingReaction, mute, userId, pushBurst]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCooldownMs(cooldownRemainingMs(lastSentAtRef.current));
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  // Close picker when clicking outside
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target) &&
        emojiBtnRef.current &&
        !emojiBtnRef.current.contains(e.target)
      ) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen]);

  const recordSend = useCallback((text) => {
    const now = Date.now();
    lastSentAtRef.current = now;
    sentTimestampsRef.current = [
      ...sentTimestampsRef.current.filter((t) => now - t < 60_000),
      now,
    ];
    recentTextsRef.current = [...recentTextsRef.current, text].slice(-3);
    setCooldownMs(cooldownRemainingMs(now));
  }, []);

  const appendSelfMessage = useCallback((text) => {
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
  }, [userId]);

  const sendText = useCallback((text) => {
    const result = validateChatMessage(text, {
      lastSentAt: lastSentAtRef.current,
      sentTimestamps: sentTimestampsRef.current,
      recentTexts: recentTextsRef.current,
    });
    if (!result.ok) return result;
    onSendMessage(result.text);
    recordSend(result.text);
    appendSelfMessage(result.text);
    return result;
  }, [onSendMessage, recordSend, appendSelfMessage]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onDismissChatError?.();
    const result = sendText(draft);
    if (!result.ok) {
      onDismissChatError?.(result.error);
      return;
    }
    setDraft("");
  };

  const handleEmojiPick = (reaction) => {
    setPickerOpen(false);
    onSendReaction?.(reaction.id);
    pushBurst(reaction.emoji, true);
    appendSelfMessage(reaction.emoji);
  };

  const handleDraftChange = (e) => {
    onDismissChatError?.();
    setDraft(e.target.value.slice(0, MAX_CHAT_LENGTH));
  };

  const toggleMute = () => {
    setMute((prev) => {
      writeMute(!prev);
      return !prev;
    });
  };

  const sendDisabled = !draft.trim() || cooldownMs > 0;
  const charCount = draft.length;

  return (
    <div className="game-social-panel">
      <div className="social-panel-head">
        <span className="social-panel-label">MESSAGES</span>
        <button
          type="button"
          className={`social-mute-btn${mute ? " muted" : ""}`}
          onClick={toggleMute}
          title={mute ? "Unmute" : "Mute"}
          aria-pressed={mute}
        >
          {mute ? "🔇" : "🔊"}
        </button>
      </div>

      {bursts.length > 0 && (
        <div className="reaction-burst-stage" aria-live="polite" aria-atomic="false">
          {bursts.map((b) => (
            <div key={b.id} className={`reaction-burst${b.fromSelf ? " self-burst" : ""}`}>
              <span className="burst-emoji">{b.emoji}</span>
            </div>
          ))}
        </div>
      )}

      {mute ? (
        <p className="social-muted-note">Messages muted</p>
      ) : (
        <div className="chat-scroll">
          {messages.length === 0 ? (
            <p className="chat-empty">Say hi to {opponentName}</p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={`${msg.at}-${i}`}
                className={`chat-line${msg.self ? " self" : ""}${isEmojiOnly(msg.text) ? " emoji-msg" : ""}`}
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
        <div className="emoji-picker-wrap">
          <button
            ref={emojiBtnRef}
            type="button"
            className={`emoji-trigger-btn${pickerOpen ? " open" : ""}`}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label="Send a reaction"
            title="Send a reaction"
          >
            😊
          </button>

          {pickerOpen && (
            <div ref={pickerRef} className="emoji-picker-popup" role="dialog" aria-label="Pick a reaction">
              {GAME_REACTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="emoji-pick-btn"
                  title={r.label}
                  onClick={() => handleEmojiPick(r)}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="chat-input-wrap">
          <input
            type="text"
            className="chat-input"
            placeholder={
              cooldownMs > 0
                ? `Wait ${Math.ceil(cooldownMs / 1000)}s…`
                : mute
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

      <p className="chat-ping">
        {pingMs !== null ? `${pingMs} ms` : "—"}
      </p>
    </div>
  );
}
