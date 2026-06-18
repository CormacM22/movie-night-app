import { useState } from "react";
import Lobby from "./Lobby";
import MovieSwipe from "./movie-swipe";
import { useMovieSocket } from "./useMovieSocket";

export default function App() {
  // session: null until the person creates/joins a room
  const [session, setSession] = useState(null);

  const { activeCount, match, noMatch, sendSwipe } = useMovieSocket(
    session?.code,
    session?.participantId
  );

  if (!session) {
    return <Lobby onJoined={setSession} />;
  }

  return (
    <MovieSwipe
      deck={session.deck}
      activeCount={activeCount}
      match={match}
      noMatch={noMatch}
      onSwipe={sendSwipe}
    />
  );
}
