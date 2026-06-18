import { useEffect, useRef, useState, useCallback } from "react";
import { wsUrl } from "./api";

// Manages the WebSocket lifecycle for a joined session: connecting,
// sending swipes, and exposing the latest match/no_match/presence state.
export function useMovieSocket(code, participantId) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [activeCount, setActiveCount] = useState(1);
  const [match, setMatch] = useState(null);
  const [noMatch, setNoMatch] = useState(null);
  const [voteUpdates, setVoteUpdates] = useState({}); // movie_id -> { votes, needed }

  useEffect(() => {
    if (!code || !participantId) return;

    const ws = new WebSocket(wsUrl(code, participantId));
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "presence":
          setActiveCount(data.active_count);
          break;
        case "swipe_update":
          setVoteUpdates((prev) => ({
            ...prev,
            [data.movie_id]: { votes: data.votes, needed: data.needed },
          }));
          break;
        case "match":
          setMatch(data.movie);
          break;
        case "no_match":
          setNoMatch(data.leaderboard);
          break;
        default:
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, [code, participantId]);

  const sendSwipe = useCallback((movieId, direction) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "swipe", movie_id: movieId, direction }));
    }
  }, []);

  return { connected, activeCount, match, noMatch, voteUpdates, sendSwipe };
}
