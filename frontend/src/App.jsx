import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { WebSocketProvider } from "./context/WebSocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { SideBar } from "./components/SideBar";
import AppTopBar from "./components/AppTopBar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import GameReviewPage from "./pages/GameReviewPage";
import LadderPage from "./pages/LadderPage";
import CompetitionsPage from "./pages/CompetitionsPage";
import CreateCompetitionPage from "./pages/CreateCompetitionPage";
import EditCompetitionPage from "./pages/EditCompetitionPage";
import CompetitionDetailPage from "./pages/CompetitionDetailPage";
import ChallengePage from "./pages/ChallengePage";
import ProfilePage from "./pages/ProfilePage";
import "./App.css";

function AppLayout({ children, showSidebar = true }) {
  return (
    <div className="layout">
      {showSidebar && (
        <aside>
          <SideBar />
        </aside>
      )}
      <main className="main-content">
        {showSidebar && <AppTopBar />}
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <NotificationProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/play"
          element={
            <ProtectedRoute>
              <AppLayout>
                <LobbyPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProfilePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/review/:gameId"
          element={
            <ProtectedRoute>
              <AppLayout>
                <GameReviewPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/game/:gameId"
          element={
            <ProtectedRoute>
              <AppLayout>
                <GamePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ladder"
          element={
            <ProtectedRoute>
              <AppLayout>
                <LadderPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/competitions"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CompetitionsPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/competitions/new"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CreateCompetitionPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/competitions/:competitionId/edit"
          element={
            <ProtectedRoute>
              <AppLayout>
                <EditCompetitionPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/competitions/:competitionId"
          element={
            <ProtectedRoute>
              <AppLayout>
                <CompetitionDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/challenge/:token"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ChallengePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/play" replace />} />
        <Route path="*" element={<Navigate to="/play" replace />} />
      </Routes>
        </NotificationProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
