// Talks to the FastAPI backend's REST endpoints (session create/join).
// WebSocket connection logic lives separately in useMovieSocket.js.

// Reads from a .env file (VITE_API_BASE=https://your-backend.onrender.com)
// so the same code works locally (falls back to 127.0.0.1) and in production.
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function fetchGenres() {
  const res = await fetch(`${API_BASE}/genres`);
  if (!res.ok) return []; // genre picker just won't show options; not fatal
  const data = await res.json();
  return data.genres || [];
}

export async function createSession(matchThreshold = 1.0, genreId = null) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ match_threshold: matchThreshold, genre_id: genreId }),
  });
  if (!res.ok) throw new Error("Could not create session");
  return res.json(); // { code }
}

export async function joinSession(code, name) {
  const res = await fetch(`${API_BASE}/sessions/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Room not found — check the code");
    throw new Error("Could not join session");
  }
  return res.json(); // { participant_id, deck, participant_count }
}

export function wsUrl(code, participantId) {
  // Derive the ws(s):// URL from API_BASE so we don't need a second env
  // var — http:// becomes ws://, https:// becomes wss:// automatically.
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/ws/${code}/${participantId}`;
}
