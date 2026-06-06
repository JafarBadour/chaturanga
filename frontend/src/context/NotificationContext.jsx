import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import { useWebSocket } from "./WebSocketContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return Promise.resolve();
    }
    setLoading(true);
    return api
      .getNotifications()
      .then((page) => {
        setNotifications(page.items);
        setUnreadCount(page.unread_count);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleWsMessage = useCallback((data) => {
    if (data.type === "notification" && data.notification) {
      const item = data.notification;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === item.id)) return prev;
        return [item, ...prev].slice(0, 50);
      });
      if (!item.read) {
        setUnreadCount((count) => count + 1);
      }
    }
  }, []);

  useWebSocket(handleWsMessage);

  const markRead = useCallback(async (ids) => {
    if (!ids.length) return;
    const res = await api.markNotificationsRead(ids);
    setUnreadCount(res.unread_count);
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await api.markAllNotificationsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const openNotification = useCallback(
    async (item) => {
      if (!item.read) {
        await markRead([item.id]);
      }
      setOpen(false);
      if (item.link) {
        navigate(item.link);
      }
    },
    [markRead, navigate]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      open,
      setOpen,
      loading,
      load,
      markRead,
      markAllRead,
      openNotification,
    }),
    [
      notifications,
      unreadCount,
      open,
      loading,
      load,
      markRead,
      markAllRead,
      openNotification,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
