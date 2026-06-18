"""
Tests the normalization logic in tmdb_client without making real network
calls — useful for verifying behavior even without a TMDB_API_KEY set,
and faster than hitting the live API every time.
"""

import asyncio
from unittest.mock import AsyncMock, patch

import tmdb_client


FAKE_GENRE_LIST = {"genres": [{"id": 28, "name": "Action"}, {"id": 35, "name": "Comedy"}]}

FAKE_DISCOVER_RESULTS = {
    "results": [
        {
            "id": 999,
            "title": "Fake Action Movie",
            "release_date": "2022-05-01",
            "genre_ids": [28],
            "vote_average": 7.34,
            "poster_path": "/abc123.jpg",
        }
    ]
}

FAKE_MOVIE_DETAILS = {"runtime": 118}


class FakeResponse:
    def __init__(self, json_data):
        self._json = json_data

    def raise_for_status(self):
        pass

    def json(self):
        return self._json


async def fake_get(self, url, params=None, **kwargs):
    if "genre/movie/list" in url:
        return FakeResponse(FAKE_GENRE_LIST)
    if "discover/movie" in url:
        return FakeResponse(FAKE_DISCOVER_RESULTS)
    if "/movie/999" in url:
        return FakeResponse(FAKE_MOVIE_DETAILS)
    raise ValueError(f"Unexpected URL in test: {url}")


async def run_test():
    tmdb_client._genre_cache = None  # reset cache between test runs
    tmdb_client.TMDB_API_KEY = "fake-key-for-test"

    with patch("httpx.AsyncClient.get", new=fake_get):
        movies = await tmdb_client.fetch_movie_deck()

    assert len(movies) == 1, f"Expected 1 movie, got {len(movies)}"
    m = movies[0]
    assert m.title == "Fake Action Movie"
    assert m.year == 2022, f"Expected year 2022, got {m.year}"
    assert m.genre == "Action", f"Expected genre 'Action', got {m.genre}"
    assert m.rating == 7.3, f"Expected rounded rating 7.3, got {m.rating}"
    assert m.runtime_minutes == 118, f"Expected runtime 118, got {m.runtime_minutes}"
    assert m.poster_url == "https://image.tmdb.org/t/p/w500/abc123.jpg"

    print("✅ tmdb_client normalization test passed!")
    print(f"   {m}")


if __name__ == "__main__":
    asyncio.run(run_test())
