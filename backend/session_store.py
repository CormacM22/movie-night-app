"""
In-memory session store.

Sessions are short-lived (a single movie-night decision), so an in-memory
dict is fine for a first version — no need for Redis/Postgres yet. If this
needs to survive server restarts or scale across multiple instances later,
swap SessionStore's internals for Redis without changing its public API.
"""

import random
import string
from typing import Dict, Optional

from fastapi import WebSocket

from models import Movie, Participant, Session
from tmdb_client import fetch_movie_deck


def generate_room_code(length: int = 4) -> str:
    # Uppercase letters only, no easily-confused chars (no O/0, I/1)
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(length))


# Offline fallback used only if TMDB_API_KEY is missing or the TMDB
# request fails — keeps the app usable for development/demoing without
# a hard dependency on an external API being reachable.
FALLBACK_DECK = [
    Movie(id="1", title="Mad Max: Fury Road", year=2015, genre="Action", rating=8.1, runtime_minutes=120),
    Movie(id="2", title="Parasite", year=2019, genre="Thriller", rating=8.5, runtime_minutes=132),
    Movie(id="3", title="The Grand Budapest Hotel", year=2014, genre="Comedy", rating=8.1, runtime_minutes=99),
    Movie(id="4", title="Whiplash", year=2014, genre="Drama", rating=8.5, runtime_minutes=107),
    Movie(id="5", title="Knives Out", year=2019, genre="Mystery", rating=7.9, runtime_minutes=130),
]


class SessionStore:
    def __init__(self):
        self.sessions: Dict[str, Session] = {}
        # session_code -> {participant_id: WebSocket}
        self.connections: Dict[str, Dict[str, WebSocket]] = {}

    async def create_session(self, match_threshold: float = 1.0, genre_id: Optional[int] = None) -> Session:
        code = generate_room_code()
        while code in self.sessions:  # avoid collisions
            code = generate_room_code()

        try:
            deck = await fetch_movie_deck(genre_id=genre_id)
            if not deck:
                deck = list(FALLBACK_DECK)
        except Exception:
            # TMDB unreachable, key missing, rate-limited, etc. — don't
            # let the whole session creation fail because of that.
            deck = list(FALLBACK_DECK)

        session = Session(code=code, deck=deck, match_threshold=match_threshold)
        self.sessions[code] = session
        self.connections[code] = {}
        return session

    def get_session(self, code: str) -> Optional[Session]:
        return self.sessions.get(code)

    def add_participant(self, code: str, participant_id: str, name: str) -> Optional[Session]:
        session = self.sessions.get(code)
        if not session:
            return None
        if participant_id in session.participants:
            session.participants[participant_id].connected = True
        else:
            session.participants[participant_id] = Participant(id=participant_id, name=name)
        return session

    def register_connection(self, code: str, participant_id: str, ws: WebSocket):
        self.connections.setdefault(code, {})[participant_id] = ws

    def remove_connection(self, code: str, participant_id: str):
        if code in self.connections:
            self.connections[code].pop(participant_id, None)
        session = self.sessions.get(code)
        if session and participant_id in session.participants:
            session.participants[participant_id].connected = False

    async def broadcast(self, code: str, message: dict):
        for ws in list(self.connections.get(code, {}).values()):
            try:
                await ws.send_json(message)
            except Exception:
                pass  # connection likely closed; will be cleaned up on disconnect


store = SessionStore()
