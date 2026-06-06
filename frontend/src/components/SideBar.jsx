import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, Trophy, LogOut, LogIn, UserPlus, User, Medal } from "lucide-react";
import { BRAND_TITLE } from "../constants/brand";
import { useAuth } from "../context/AuthContext";
import "./SideBar.css";

export const SideBar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <aside className="side-bar lichess-sidebar">
      <Link to="/play" className="logo-link" title={BRAND_TITLE}>
        <span className="logo-text">♟</span>
      </Link>

      {user ? (
        <>
          <Link to="/play" className={`icon ${isActive("/play") ? "active" : ""}`} title="Play">
            <Home size={22} />
          </Link>
          <Link to="/ladder" className={`icon ${isActive("/ladder") ? "active" : ""}`} title="Ladder">
            <Trophy size={22} />
          </Link>
          <Link
            to="/competitions"
            className={`icon ${isActive("/competitions") ? "active" : ""}`}
            title="Competitions"
          >
            <Medal size={22} />
          </Link>
          <Link to="/profile" className={`icon ${isActive("/profile") ? "active" : ""}`} title="Profile">
            <User size={22} />
          </Link>

          <div className="sidebar-spacer" />

          <Link
            to="/profile"
            className="sidebar-user sidebar-user-link"
            title={`${user.username} · Profile`}
          >
            <span className="user-rating">{user.ratings?.blitz?.rating ?? user.rating}</span>
          </Link>

          <button type="button" className="icon logout-icon" onClick={handleLogout} title="Logout">
            <LogOut size={20} />
          </button>
        </>
      ) : (
        <>
          <Link to="/login" className={`icon ${isActive("/login") ? "active" : ""}`} title="Login">
            <LogIn size={22} />
          </Link>
          <Link to="/register" className={`icon ${isActive("/register") ? "active" : ""}`} title="Register">
            <UserPlus size={22} />
          </Link>
        </>
      )}
    </aside>
  );
};
