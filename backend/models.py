"""
Core data models for a movie-night session.

A Session is a short-lived "room" that a group joins via a code.
It holds a fixed deck of movies and tracks every swipe so we can
detect matches and compute a fallback ranking if nothing matches outright.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional
import time


class SwipeDirection(str, Enum):
    LEFT = "left"   # pass
    RIGHT = "right"  # want to watch


@dataclass
class WatchProvider:
    name: str
    logo_url: Optional[str] = None


@dataclass
class WatchProviders:
    flatrate: List[WatchProvider] = field(default_factory=list)  # subscription (Netflix, Prime, etc.)
    rent: List[WatchProvider] = field(default_factory=list)
    buy: List[WatchProvider] = field(default_factory=list)


@dataclass
class Movie:
    id: str
    title: str
    year: int
    genre: str
    rating: float
    runtime_minutes: int
    poster_url: Optional[str] = None
    overview: Optional[str] = None
    watch_providers: Optional[WatchProviders] = None


@dataclass
class Participant:
    id: str
    name: str
    connected: bool = True
    # movie_id -> direction
    swipes: Dict[str, SwipeDirection] = field(default_factory=dict)


@dataclass
class Session:
    code: str
    deck: List[Movie]
    participants: Dict[str, Participant] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    match: Optional[Movie] = None  # set once a match is found
    match_threshold: float = 1.0  # 1.0 = unanimous, 0.75 = 75% of active participants

    def active_participant_count(self) -> int:
        return sum(1 for p in self.participants.values() if p.connected)

    def votes_for(self, movie_id: str) -> int:
        return sum(
            1
            for p in self.participants.values()
            if p.connected and p.swipes.get(movie_id) == SwipeDirection.RIGHT
        )

    def required_votes(self) -> int:
        active = self.active_participant_count()
        # always need at least 2 people to agree, even in small groups
        return max(2, round(active * self.match_threshold))

    def everyone_has_swiped(self, movie_id: str) -> bool:
        return all(
            movie_id in p.swipes for p in self.participants.values() if p.connected
        )

    def remaining_for(self, participant_id: str) -> List[Movie]:
        """Movies a given participant hasn't swiped on yet."""
        p = self.participants.get(participant_id)
        if not p:
            return self.deck
        return [m for m in self.deck if m.id not in p.swipes]

    def leaderboard(self) -> List[Movie]:
        """Movies ranked by right-swipe count, for the no-unanimous-match fallback."""
        return sorted(self.deck, key=lambda m: self.votes_for(m.id), reverse=True)
