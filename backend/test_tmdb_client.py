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
            "overview": "A test synopsis about things blowing up.",
        }
    ]
}

FAKE_MOVIE_DETAILS = {"runtime": 118}

FAKE_WATCH_PROVIDERS = {
    "results": {
        "IE": {
            "flatrate": [
                {"provider_name": "Netflix", "logo_path": "/netflix.jpg"},
            ],
            "rent": [
                {"provider_name": "Apple TV", "logo_path": "/appletv.jpg"},
            ],
            "buy": [],
        },
        "US": {
            "flatrate": [{"provider_name": "Hulu", "logo_path": "/hulu.jpg"}],
        },
    }
}


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
    if "/movie/999/watch/providers" in url:
        return FakeResponse(FAKE_WATCH_PROVIDERS)
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
    assert m.overview == "A test synopsis about things blowing up.", f"Expected overview text, got {m.overview!r}"

    assert m.watch_providers is not None, "Expected watch_providers to be populated"
    assert len(m.watch_providers.flatrate) == 1
    assert m.watch_providers.flatrate[0].name == "Netflix"
    assert m.watch_providers.flatrate[0].logo_url == "https://image.tmdb.org/t/p/w92/netflix.jpg"
    assert len(m.watch_providers.rent) == 1
    assert m.watch_providers.rent[0].name == "Apple TV"
    assert m.watch_providers.buy == [], "Expected empty buy list, not missing/None"

    print("✅ tmdb_client normalization test passed!")
    print(f"   {m}")


async def run_watch_region_test():
    """Confirms watch providers are pulled from the configured region (IE),
    not some other region present in the same API response (e.g. US) —
    catching a regression where the wrong country key gets used."""
    tmdb_client._genre_cache = None
    tmdb_client.TMDB_API_KEY = "fake-key-for-test"
    assert tmdb_client.WATCH_REGION == "IE", f"Expected WATCH_REGION to be IE, got {tmdb_client.WATCH_REGION}"

    with patch("httpx.AsyncClient.get", new=fake_get):
        movies = await tmdb_client.fetch_movie_deck()

    wp = movies[0].watch_providers
    provider_names = [p.name for p in wp.flatrate]
    assert "Netflix" in provider_names, "Expected IE region's Netflix entry"
    assert "Hulu" not in provider_names, "Should not pull in US region's Hulu entry"

    print("✅ tmdb_client watch-region test passed!")


async def run_filter_params_test():
    """Verifies that excluding in-theater movies and filtering by genre
    actually sends the right query params to TMDB's discover endpoint —
    catching regressions where the filter is silently dropped."""
    tmdb_client._genre_cache = None
    tmdb_client.TMDB_API_KEY = "fake-key-for-test"

    captured_params = {}

    async def capturing_get(self, url, params=None, **kwargs):
        if "discover/movie" in url:
            captured_params.update(params or {})
        return await fake_get(self, url, params=params, **kwargs)

    with patch("httpx.AsyncClient.get", new=capturing_get):
        await tmdb_client.fetch_movie_deck(genre_id=28, exclude_in_theaters=True)

    assert "release_date.lte" in captured_params, "Expected release_date.lte to be set when excluding in-theater movies"
    assert captured_params["with_genres"] == 28, f"Expected with_genres=28, got {captured_params.get('with_genres')}"

    # Confirm the cutoff is roughly THEATRICAL_WINDOW_DAYS in the past, not today
    from datetime import date
    cutoff = date.fromisoformat(captured_params["release_date.lte"])
    days_ago = (date.today() - cutoff).days
    assert days_ago == tmdb_client.THEATRICAL_WINDOW_DAYS, (
        f"Expected cutoff {tmdb_client.THEATRICAL_WINDOW_DAYS} days ago, got {days_ago}"
    )

    # Now confirm exclude_in_theaters=False omits the date filter entirely
    captured_params.clear()
    tmdb_client._genre_cache = None
    with patch("httpx.AsyncClient.get", new=capturing_get):
        await tmdb_client.fetch_movie_deck(exclude_in_theaters=False)
    assert "release_date.lte" not in captured_params, "release_date.lte should be omitted when exclude_in_theaters=False"

    print("✅ tmdb_client filter params test passed!")


async def run_caching_test():
    """Confirms repeated fetches for the same movie reuse the cache instead
    of hitting the network again, and that an expired entry triggers a
    fresh fetch — catching both 'cache never used' and 'cache never
    expires' regressions."""
    tmdb_client._genre_cache = None
    tmdb_client._details_cache.clear()
    tmdb_client.TMDB_API_KEY = "fake-key-for-test"

    call_counts = {"runtime": 0, "providers": 0}

    async def counting_get(self, url, params=None, **kwargs):
        if "/movie/999/watch/providers" in url:
            call_counts["providers"] += 1
            return FakeResponse(FAKE_WATCH_PROVIDERS)
        if "/movie/999" in url:
            call_counts["runtime"] += 1
            return FakeResponse(FAKE_MOVIE_DETAILS)
        return await fake_get(self, url, params=params, **kwargs)

    with patch("httpx.AsyncClient.get", new=counting_get):
        await tmdb_client.fetch_movie_deck()
    assert call_counts == {"runtime": 1, "providers": 1}, f"Expected one call each on first fetch, got {call_counts}"

    # Second fetch for the same movie should hit the cache, not the network
    with patch("httpx.AsyncClient.get", new=counting_get):
        await tmdb_client.fetch_movie_deck()
    assert call_counts == {"runtime": 1, "providers": 1}, (
        f"Expected cache to prevent new calls on second fetch, got {call_counts}"
    )

    # Force the cached entry to look expired, then confirm a third fetch re-hits the network
    movie_id = 999
    fetched_at, details = tmdb_client._details_cache[movie_id]
    expired_timestamp = fetched_at - tmdb_client.DETAILS_CACHE_TTL_SECONDS - 1
    tmdb_client._details_cache[movie_id] = (expired_timestamp, details)

    with patch("httpx.AsyncClient.get", new=counting_get):
        await tmdb_client.fetch_movie_deck()
    assert call_counts == {"runtime": 2, "providers": 2}, (
        f"Expected expired cache entry to trigger fresh calls, got {call_counts}"
    )

    print("✅ tmdb_client caching test passed!")


if __name__ == "__main__":
    asyncio.run(run_test())
    asyncio.run(run_filter_params_test())
    asyncio.run(run_watch_region_test())
    asyncio.run(run_caching_test())
