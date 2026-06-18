"""
Movie Night backend.

Flow:
  1. POST /sessions            -> create a room, get back a code
  2. POST /sessions/{code}/join -> a participant joins, gets their deck
  3. WS   /ws/{code}/{participant_id} -> real-time swiping + match broadcast

Run with: uvicorn main:app --reload
"""

import uuid
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import SwipeDirection
from session_store import store
from tmdb_client import get_genre_list

app = FastAPI(title="Movie Night")

# Allow the frontend (likely on a different port/origin during development)
# to talk to this API. Tighten this to your actual frontend origin in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateSessionRequest(BaseModel):
    match_threshold: float = 1.0  # 1.0 = unanimous required
    genre_id: Optional[int] = None  # None = no genre filter, any genre


class JoinSessionRequest(BaseModel):
    name: str


def movie_to_dict(movie):
    return {
        "id": movie.id,
        "title": movie.title,
        "year": movie.year,
        "genre": movie.genre,
        "rating": movie.rating,
        "runtime_minutes": movie.runtime_minutes,
        "poster_url": movie.poster_url,
    }


@app.get("/genres")
async def list_genres():
    """Returns TMDB's genre list for the lobby's genre picker.
    Falls back to an empty list if TMDB is unreachable — the frontend
    treats that as 'show a generic picker with no genre filter option'."""
    try:
        return {"genres": await get_genre_list()}
    except Exception:
        return {"genres": []}


@app.post("/sessions")
async def create_session(req: CreateSessionRequest):
    session = await store.create_session(match_threshold=req.match_threshold, genre_id=req.genre_id)
    return {"code": session.code}


@app.post("/sessions/{code}/join")
def join_session(code: str, req: JoinSessionRequest):
    session = store.get_session(code)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    participant_id = str(uuid.uuid4())
    store.add_participant(code, participant_id, req.name)

    return {
        "participant_id": participant_id,
        "deck": [movie_to_dict(m) for m in session.deck],
        "participant_count": session.active_participant_count(),
    }


@app.websocket("/ws/{code}/{participant_id}")
async def websocket_endpoint(ws: WebSocket, code: str, participant_id: str):
    session = store.get_session(code)
    if not session or participant_id not in session.participants:
        await ws.close(code=4404)
        return

    await ws.accept()
    store.register_connection(code, participant_id, ws)
    session.participants[participant_id].connected = True

    # Let everyone know who's in the room now
    await store.broadcast(code, {
        "type": "presence",
        "active_count": session.active_participant_count(),
        "participants": [
            {"id": p.id, "name": p.name, "connected": p.connected}
            for p in session.participants.values()
        ],
    })

    try:
        while True:
            data = await ws.receive_json()

            if data.get("type") == "swipe":
                await handle_swipe(code, participant_id, data)

    except WebSocketDisconnect:
        store.remove_connection(code, participant_id)
        await store.broadcast(code, {
            "type": "presence",
            "active_count": session.active_participant_count(),
            "participants": [
                {"id": p.id, "name": p.name, "connected": p.connected}
                for p in session.participants.values()
            ],
        })


async def handle_swipe(code: str, participant_id: str, data: dict):
    session = store.get_session(code)
    if not session or session.match:
        return  # ignore swipes after a match is already locked in

    movie_id = data.get("movie_id")
    direction = data.get("direction")
    if movie_id is None or direction not in (SwipeDirection.LEFT, SwipeDirection.RIGHT):
        return

    movie = next((m for m in session.deck if m.id == movie_id), None)
    if not movie:
        return

    participant = session.participants[participant_id]
    participant.swipes[movie_id] = SwipeDirection(direction)

    votes = session.votes_for(movie_id)
    needed = session.required_votes()
    just_matched = direction == SwipeDirection.RIGHT and votes >= needed

    if not just_matched:
        # Tell everyone a swipe happened (lightweight — just counts, no
        # spoilers about who swiped which way, to avoid social pressure)
        await store.broadcast(code, {
            "type": "swipe_update",
            "movie_id": movie_id,
            "votes": votes,
            "needed": needed,
        })

    if just_matched:
        session.match = movie
        await store.broadcast(code, {
            "type": "match",
            "movie": movie_to_dict(movie),
        })
        return

    # If everyone has now swiped on every movie and still no match,
    # offer the leaderboard as a fallback.
    deck_exhausted = all(session.everyone_has_swiped(m.id) for m in session.deck)
    if deck_exhausted:
        leaderboard = session.leaderboard()
        await store.broadcast(code, {
            "type": "no_match",
            "leaderboard": [
                {"movie": movie_to_dict(m), "votes": session.votes_for(m.id)}
                for m in leaderboard[:3]
            ],
        })
