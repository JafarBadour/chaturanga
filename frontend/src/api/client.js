const API_URL =
  process.env.REACT_APP_API_URL ??
  (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail;
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(", ")
      : detail || data.message || "Request failed";
    throw new Error(message);
  }
  return data;
}

export const api = {
  register: (username, email, password) =>
    request("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),

  login: (username, password) =>
    request("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request("/api/v1/auth/me"),

  logout: () => request("/api/v1/auth/logout", { method: "POST" }),

  seek: (timeControl) =>
    request("/api/v1/games/seek", {
      method: "POST",
      body: JSON.stringify({ time_control: timeControl }),
    }),

  cancelSeek: () => request("/api/v1/games/seek", { method: "DELETE" }),

  createChallenge: ({ time_control, game_mode, recipient_username }) =>
    request("/api/v1/games/challenges", {
      method: "POST",
      body: JSON.stringify({
        time_control,
        game_mode,
        recipient_username: recipient_username || null,
      }),
    }),

  getChallenge: (token) => request(`/api/v1/games/challenges/${token}`),

  acceptChallenge: (token) =>
    request(`/api/v1/games/challenges/${token}/accept`, { method: "POST" }),

  getGame: (gameId) => request(`/api/v1/games/${gameId}`),

  getGameReplay: (gameId) => request(`/api/v1/games/${gameId}/replay`),

  getGameHistory: ({ group, pool, offset = 0, limit = 20 } = {}) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    if (group) params.set("group", group);
    if (pool) params.set("pool", pool);
    return request(`/api/v1/games/history?${params.toString()}`);
  },

  getLadderPools: () => request("/api/v1/ladder/pools"),

  getLadderPage: (pool, { offset = 0, limit = 20, anchor = null } = {}) => {
    const params = new URLSearchParams({
      pool,
      offset: String(offset),
      limit: String(limit),
    });
    if (anchor) params.set("anchor", anchor);
    return request(`/api/v1/ladder/page?${params.toString()}`);
  },

  getCompetitions: ({ status = "upcoming", offset = 0, limit = 15 } = {}) => {
    const params = new URLSearchParams({
      status,
      offset: String(offset),
      limit: String(limit),
    });
    return request(`/api/v1/competitions?${params.toString()}`);
  },

  createCompetition: (payload) =>
    request("/api/v1/competitions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCompetition: (competitionId, payload) =>
    request(`/api/v1/competitions/${competitionId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getCompetition: (competitionId, { invite } = {}) => {
    const params = new URLSearchParams();
    if (invite) params.set("invite", invite);
    const qs = params.toString();
    return request(`/api/v1/competitions/${competitionId}${qs ? `?${qs}` : ""}`);
  },

  joinCompetition: (competitionId, { invite } = {}) =>
    request(`/api/v1/competitions/${competitionId}/join`, {
      method: "POST",
      body: JSON.stringify(invite ? { invite_token: invite } : {}),
    }),

  leaveCompetition: (competitionId, { invite } = {}) => {
    const params = new URLSearchParams();
    if (invite) params.set("invite", invite);
    const qs = params.toString();
    return request(`/api/v1/competitions/${competitionId}/leave${qs ? `?${qs}` : ""}`, {
      method: "POST",
    });
  },

  getNotifications: ({ offset = 0, limit = 30 } = {}) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    return request(`/api/v1/notifications?${params.toString()}`);
  },

  markNotificationsRead: (notificationIds) =>
    request("/api/v1/notifications/read", {
      method: "POST",
      body: JSON.stringify({ notification_ids: notificationIds }),
    }),

  markAllNotificationsRead: () =>
    request("/api/v1/notifications/read-all", { method: "POST" }),

  getWsUrl: () => {
    const wsBase = API_URL.replace(/^http/, "ws");
    const token = getToken();
    return `${wsBase}/ws?token=${token}`;
  },
};

export { API_URL };
