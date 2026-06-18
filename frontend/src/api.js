// Talks to the FastAPI backend's REST endpoints (session create/join).
// WebSocket connection logic lives separately in useMovieSocket.js.

const API_BASE = "http://127.0.0.1:8000";

export async function createSession(matchThreshold = 1.0) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ match_threshold: matchThreshold }),
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
  return `ws://127.0.0.1:8000/ws/${code}/${participantId}`;
}
