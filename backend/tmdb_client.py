"""
Thin client around TMDB's API. Fetches a page of popular, well-reviewed
movies and normalizes them into our own Movie shape (see models.py).

Genre IDs from TMDB are mapped to readable names via a small cache fetched
once at startup, since /discover/movie only returns genre_ids, not names.
"""

import os
from datetime import date, timedelta
from typing import List, Optional

import httpx
from dotenv import load_dotenv

from models import Movie

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY")
TMDB_BASE_URL = "https://api.themoviedb.org/3"
POSTER_BASE_URL = "https://image.tmdb.org/t/p/w500"

# TMDB has no "is this still in theaters" flag, so we approximate it by
# release date: movies typically hit digital/streaming 90-120 days after
# theatrical release. Using a 120-day cutoff errs on the safe side — it
# may exclude a few movies that already left theaters, but it should never
# include something a friend could see is still playing nearby.
THEATRICAL_WINDOW_DAYS = 120

_genre_cache: Optional[dict] = None  # genre_id -> name
_genre_name_to_id_cache: Optional[dict] = None  # lowercase name -> id


async def _get_genre_map(client: httpx.AsyncClient) -> dict:
    global _genre_cache
    if _genre_cache is not None:
        return _genre_cache

    resp = await client.get(
        f"{TMDB_BASE_URL}/genre/movie/list",
        params={"api_key": TMDB_API_KEY, "language": "en-US"},
    )
    resp.raise_for_status()
    genres = resp.json().get("genres", [])
    _genre_cache = {g["id"]: g["name"] for g in genres}
    return _genre_cache


async def get_genre_list() -> List[dict]:
    """Returns [{id, name}, ...] for the frontend to render a genre picker."""
    if not TMDB_API_KEY:
        raise RuntimeError(
            "TMDB_API_KEY is not set. Add it to backend/.env as TMDB_API_KEY=your_key"
        )
    async with httpx.AsyncClient(timeout=10) as client:
        genre_map = await _get_genre_map(client)
    return [{"id": gid, "name": name} for gid, name in sorted(genre_map.items(), key=lambda x: x[1])]


async def _get_runtime(client: httpx.AsyncClient, movie_id: int) -> int:
    """Runtime isn't in /discover/movie results, so fetch it from the
    movie details endpoint. Failures fall back to 0 rather than blocking
    the whole deck on one bad lookup."""
    try:
        resp = await client.get(
            f"{TMDB_BASE_URL}/movie/{movie_id}",
            params={"api_key": TMDB_API_KEY, "language": "en-US"},
        )
        resp.raise_for_status()
        return resp.json().get("runtime") or 0
    except httpx.HTTPError:
        return 0


async def fetch_movie_deck(
    page: int = 1,
    min_rating: float = 6.5,
    genre_id: Optional[int] = None,
    exclude_in_theaters: bool = True,
) -> List[Movie]:
    """
    Fetch a deck of movies from TMDB's discover endpoint, sorted by
    popularity, filtered to a minimum rating so the deck doesn't fill
    up with obscure low-quality results.

    exclude_in_theaters: when True (default), only includes movies released
    more than THEATRICAL_WINDOW_DAYS ago, so the deck doesn't suggest
    something a friend would have to go to the cinema for.
    """
    if not TMDB_API_KEY:
        raise RuntimeError(
            "TMDB_API_KEY is not set. Add it to backend/.env as TMDB_API_KEY=your_key"
        )

    async with httpx.AsyncClient(timeout=10) as client:
        genre_map = await _get_genre_map(client)

        params = {
            "api_key": TMDB_API_KEY,
            "language": "en-US",
            "sort_by": "popularity.desc",
            "vote_average.gte": min_rating,
            "vote_count.gte": 200,  # avoid obscure titles with 1-2 ratings
            "page": page,
            "include_adult": False,
        }
        if genre_id:
            params["with_genres"] = genre_id
        if exclude_in_theaters:
            cutoff = date.today() - timedelta(days=THEATRICAL_WINDOW_DAYS)
            params["release_date.lte"] = cutoff.isoformat()

        resp = await client.get(f"{TMDB_BASE_URL}/discover/movie", params=params)
        resp.raise_for_status()
        results = resp.json().get("results", [])

        movies = []
        for item in results:
            genre_names = [genre_map.get(gid, "") for gid in item.get("genre_ids", [])]
            primary_genre = next((g for g in genre_names if g), "Unknown")

            release_date = item.get("release_date") or ""
            year = int(release_date[:4]) if release_date[:4].isdigit() else 0

            poster_path = item.get("poster_path")
            poster_url = f"{POSTER_BASE_URL}{poster_path}" if poster_path else None

            runtime = await _get_runtime(client, item["id"])

            movies.append(
                Movie(
                    id=str(item["id"]),
                    title=item.get("title", "Untitled"),
                    year=year,
                    genre=primary_genre,
                    rating=round(item.get("vote_average", 0), 1),
                    runtime_minutes=runtime,
                    poster_url=poster_url,
                )
            )

    return movies
