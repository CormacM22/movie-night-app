# Movie Night — backend

A FastAPI + WebSocket backend for group movie swiping. Built to pair with
the React swipe UI artifact from this conversation.

## How it works

1. `POST /sessions` — someone creates a room, gets back a 4-letter code
2. `POST /sessions/{code}/join` — each friend joins with their name, gets
   back a `participant_id` and the shared deck of movies
3. `WS /ws/{code}/{participant_id}` — everyone connects over WebSocket;
   swipes are sent as `{"type": "swipe", "movie_id": "...", "direction": "left" | "right"}`
4. The server broadcasts:
   - `swipe_update` — vote count so far on a movie (no spoilers on who voted which way)
   - `match` — a movie crossed the required vote threshold, everyone gets it instantly
   - `no_match` — the whole deck got swiped with nothing reaching threshold; includes
     a top-3 leaderboard by right-swipe count as a fallback pick

`match_threshold` (0–1, default 1.0) controls how much agreement is needed —
1.0 means unanimous, 0.75 means "75% of the group."

## Running it

1. Get a free TMDB API key at themoviedb.org (Settings → API → Request a key, Developer plan)
2. Create a file named `.env` in this folder with:
   ```
   TMDB_API_KEY=your_key_here
   ```
3. Install dependencies and run:
   ```bash
   pip install fastapi "uvicorn[standard]" python-dotenv httpx
   uvicorn main:app --reload
   ```

If `TMDB_API_KEY` is missing or TMDB is unreachable, the app automatically
falls back to a small built-in sample deck so it still runs — you just won't
get real movie data or posters until the key is set.

Then point your frontend's WebSocket client at `ws://localhost:8000/ws/{code}/{participant_id}`.

## Files

- `models.py` — Session, Participant, Movie data classes + match-counting logic
- `tmdb_client.py` — fetches real movies from TMDB (genre names, posters, runtime, rating),
  normalized into our own Movie shape
- `session_store.py` — in-memory session registry (swap for Redis later if you need
  multi-instance scaling; the public API is the same either way)
- `main.py` — the actual FastAPI app: REST endpoints + WebSocket handler
- `test_flow.py` — end-to-end smoke test (two participants join, swipe, get a match).
  Run with `python3 test_flow.py` any time you touch the matching logic.
- `test_tmdb_client.py` — tests TMDB data normalization with mocked HTTP responses,
  so it runs without a real API key or network access. Run with `python3 test_tmdb_client.py`.

## Known simplifications (intentional, for a first version)

- The deck is a fixed sample list — swap for a real TMDB fetch filtered by
  the group's streaming services
- Sessions live only in memory — they vanish on server restart, which is
  fine since a session is just "tonight's decision," not something to persist
- No auth — anyone with the room code can join, which matches the casual,
  low-stakes nature of the app
