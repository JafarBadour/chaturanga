import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { wsClient } from "../api/wsClient";
import { useAuth } from "./AuthContext";

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [pingMs, setPingMs] = useState(null);
  const [activeGames, setActiveGames] = useState([]);
  const userId = user?.id;

  // Keep activeGames up-to-date from WS events, here at the Provider level
  // so the list survives route changes (SideBar remounts on every navigation).
  const handleActiveGamesMessage = useCallback((data) => {
    if (data.type === "active_games") {
      setActiveGames(data.games ?? []);
    } else if (data.type === "matched" && data.game_summary) {
      setActiveGames((prev) => {
        if (prev.some((g) => g.game_id === data.game_summary.game_id)) return prev;
        return [data.game_summary, ...prev];
      });
    } else if (data.type === "game_over" && data.game?.id) {
      setActiveGames((prev) => prev.filter((g) => g.game_id !== data.game.id));
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      wsClient.disconnect();
      setConnected(false);
      setActiveGames([]);
      return undefined;
    }

    wsClient.connect();
    const unsubConn = wsClient.onConnectedChange(setConnected);
    const unsubPing = wsClient.subscribePing(setPingMs);
    const unsubGames = wsClient.subscribe(handleActiveGamesMessage);
    return () => { unsubConn(); unsubPing(); unsubGames(); };
  }, [userId, handleActiveGamesMessage]);

  const send = useCallback((payload) => wsClient.send(payload), []);
  const subscribe = useCallback((handler) => wsClient.subscribe(handler), []);

  return (
    <WebSocketContext.Provider value={{ send, connected, subscribe, pingMs, activeGames }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(onMessage) {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWebSocket must be used within WebSocketProvider");

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const handler = (data) => onMessageRef.current?.(data);
    return ctx.subscribe(handler);
  }, [ctx]);

  return { send: ctx.send, connected: ctx.connected, pingMs: ctx.pingMs, activeGames: ctx.activeGames };
}
