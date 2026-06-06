import React, { useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import "./NotificationBell.css";

function formatWhen(iso) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NotificationBell() {
  const {
    notifications,
    unreadCount,
    open,
    setOpen,
    loading,
    markAllRead,
    openNotification,
  } = useNotifications();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, setOpen]);

  return (
    <div className="notification-bell-wrap" ref={panelRef}>
      <button
        type="button"
        className={`notification-bell-btn${open ? " open" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-head">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <button type="button" className="notification-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading && notifications.length === 0 && (
              <p className="notification-empty">Loading…</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="notification-empty">No notifications yet</p>
            )}
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`notification-item${item.read ? "" : " unread"}`}
                onClick={() => openNotification(item)}
              >
                <div className="notification-item-top">
                  <span className="notification-item-title">{item.title}</span>
                  <span className="notification-item-time">{formatWhen(item.created_at)}</span>
                </div>
                {item.body && <p className="notification-item-body">{item.body}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
