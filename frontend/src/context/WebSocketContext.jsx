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
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      wsClient.disconnect();
      setConnected(false);
      return undefined;
    }

    wsClient.connect();
    return wsClient.onConnectedChange(setConnected);
  }, [userId]);

  const send = useCallback((payload) => wsClient.send(payload), []);
  const subscribe = useCallback((handler) => wsClient.subscribe(handler), []);

  return (
    <WebSocketContext.Provider value={{ send, connected, subscribe }}>
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

  return { send: ctx.send, connected: ctx.connected };
}
