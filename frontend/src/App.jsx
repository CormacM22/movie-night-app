import { useState } from "react";
import Lobby from "./Lobby";
import MovieSwipe from "./movie-swipe";
import { useMovieSocket } from "./useMovieSocket";

export default function App() {
  // session: null until the person creates/joins a room
  const [session, setSession] = useState(null);
  // bumped on every "go home" so Lobby remounts with clean state
  // (otherwise leftover name/code from the previous round would persist)
  const [lobbyKey, setLobbyKey] = useState(0);

  const { activeCount, participants, match, noMatch, sendSwipe } = useMovieSocket(
    session?.code,
    session?.participantId
  );

  const goHome = () => {
    setSession(null);
    setLobbyKey((k) => k + 1);
  };

  if (!session) {
    return <Lobby key={lobbyKey} onJoined={setSession} />;
  }

  return (
    <MovieSwipe
      deck={session.deck}
      activeCount={activeCount}
      participants={participants}
      match={match}
      noMatch={noMatch}
      onSwipe={sendSwipe}
      onGoHome={goHome}
    />
  );
}
