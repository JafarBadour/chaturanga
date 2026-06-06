import React from "react";
import ChallengeButton from "./ChallengeButton";
import NotificationBell from "./NotificationBell";
import { useAuth } from "../context/AuthContext";
import "./AppTopBar.css";

export default function AppTopBar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <header className="app-topbar">
      <div className="app-topbar-actions">
        <ChallengeButton />
        <NotificationBell />
      </div>
    </header>
  );
}
