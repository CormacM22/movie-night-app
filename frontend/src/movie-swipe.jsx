import { useState, useRef } from "react";
import { Star, Clock } from "lucide-react";

const colors = {
  bg: "#15131A",
  surface: "#1F1B26",
  text: "#F2EFE9",
  muted: "#8B8594",
  orange: "#FF6B4A",
  blue: "#4AC9FF",
  border: "#3A3640",
};

// Backend doesn't send a poster image, so we derive a stable gradient
// per movie id so each card still looks visually distinct.
const GRADIENTS = [
  "linear-gradient(160deg, #D85A30 0%, #4A1B0C 100%)",
  "linear-gradient(160deg, #1D9E75 0%, #04342C 100%)",
  "linear-gradient(160deg, #D4537E 0%, #4B1528 100%)",
  "linear-gradient(160deg, #BA7517 0%, #412402 100%)",
  "linear-gradient(160deg, #378ADD 0%, #042C53 100%)",
];

function gradientFor(id) {
  const n = typeof id === "number" ? id : String(id).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[n % GRADIENTS.length];
}

function HomeButton({ onClick, style }) {
  return (
    <button
      onClick={onClick}
      aria-label="Leave room"
      style={{
        width: "38px",
        height: "38px",
        borderRadius: "50%",
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        ...style,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
      </svg>
    </button>
  );
}

function MovieCard({ movie, isTop, dragX, dragRotate, flipped, onToggleFlip }) {
  const showBack = isTop && flipped;

  const flatrate = movie.watch_providers?.flatrate || [];
  const rentOrBuy = [...(movie.watch_providers?.rent || []), ...(movie.watch_providers?.buy || [])];
  // de-dupe rent/buy by name (a service often appears in both lists)
  const rentOrBuyUnique = Array.from(new Map(rentOrBuy.map((p) => [p.name, p])).values());
  const hasAnyProvider = flatrate.length > 0 || rentOrBuyUnique.length > 0;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: "20px",
        overflow: "hidden",
        background: colors.surface,
        display: "flex",
        flexDirection: "column",
        boxShadow: isTop
          ? `0 25px 60px -15px rgba(0,0,0,0.6), 0 0 80px -20px ${
              dragX > 30 ? "rgba(255,107,74,0.5)" : dragX < -30 ? "rgba(74,201,255,0.5)" : "rgba(0,0,0,0)"
            }`
          : "0 10px 30px -10px rgba(0,0,0,0.4)",
        transform: isTop
          ? `translateX(${dragX}px) rotate(${dragRotate}deg)`
          : "scale(0.95) translateY(10px)",
        transition: isTop ? "none" : "transform 0.3s ease",
        cursor: isTop ? "grab" : "default",
        userSelect: "none",
      }}
    >
      {showBack ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggleFlip();
          }}
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: "20px",
            boxSizing: "border-box",
            cursor: "pointer",
          }}
        >
          <h2
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: "16px",
              color: colors.text,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {movie.title}
          </h2>
          <p style={{ color: colors.muted, fontSize: "12px", margin: "4px 0 16px", fontFamily: "'Inter', sans-serif" }}>
            {movie.year} · {movie.genre}
          </p>
          <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto" }}>
            <p
              style={{
                color: colors.text,
                fontSize: "14px",
                lineHeight: 1.6,
                fontFamily: "'Inter', sans-serif",
                margin: 0,
              }}
            >
              {movie.overview || "No synopsis available for this one — guess you'll have to find out together."}
            </p>

            {hasAnyProvider && (
              <div style={{ marginTop: "16px" }}>
                <p style={{ color: colors.muted, fontSize: "10px", letterSpacing: "1px", margin: "0 0 8px", fontFamily: "'Inter', sans-serif" }}>
                  WHERE TO WATCH
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {flatrate.map((p) => (
                    <span
                      key={`flat-${p.name}`}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "3px 9px",
                        borderRadius: "20px",
                        background: colors.orange,
                        color: "#15131A",
                      }}
                    >
                      {p.name}
                    </span>
                  ))}
                  {rentOrBuyUnique.map((p) => (
                    <span
                      key={`rb-${p.name}`}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        fontWeight: 500,
                        padding: "3px 9px",
                        borderRadius: "20px",
                        border: `1px solid ${colors.border}`,
                        color: colors.muted,
                      }}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p
            style={{
              color: colors.muted,
              fontSize: "11px",
              fontFamily: "'Inter', sans-serif",
              textAlign: "center",
              marginTop: "12px",
              marginBottom: 0,
              letterSpacing: "0.5px",
            }}
          >
            TAP TO GO BACK
          </p>
        </div>
      ) : (
        <>
          <div style={{ position: "relative", width: "100%", flex: "1 1 auto", minHeight: 0 }}>
            {movie.poster_url ? (
              <img
                src={movie.poster_url}
                alt={movie.title}
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: gradientFor(movie.id),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" />
                </svg>
              </div>
            )}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(to bottom, transparent 60%, ${colors.surface} 100%)`,
              }}
            />

            {isTop && movie.overview && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFlip();
                }}
                aria-label="Show synopsis"
                style={{
                  position: "absolute",
                  bottom: "12px",
                  right: "12px",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  border: "none",
                  background: "#F2EFE9",
                  color: "#15131A",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  fontStyle: "italic",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                }}
              >
                i
              </button>
            )}

            {isTop && dragX > 30 && (
              <div
                style={{
                  position: "absolute",
                  top: "24px",
                  right: "24px",
                  padding: "8px 16px",
                  border: `3px solid ${colors.orange}`,
                  borderRadius: "8px",
                  color: colors.orange,
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: "22px",
                  letterSpacing: "1px",
                  transform: "rotate(12deg)",
                  opacity: Math.min(dragX / 100, 1),
                }}
              >
                WATCH
              </div>
            )}
            {isTop && dragX < -30 && (
              <div
                style={{
                  position: "absolute",
                  top: "24px",
                  left: "24px",
                  padding: "8px 16px",
                  border: `3px solid ${colors.blue}`,
                  borderRadius: "8px",
                  color: colors.blue,
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: "22px",
                  letterSpacing: "1px",
                  transform: "rotate(-12deg)",
                  opacity: Math.min(-dragX / 100, 1),
                }}
              >
                PASS
              </div>
            )}
          </div>

          <div
            style={{
              padding: "14px 20px 16px",
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: "18px",
                  color: colors.text,
                  margin: 0,
                  lineHeight: 1.25,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {movie.title}
              </h2>
              <p style={{ color: colors.muted, fontSize: "13px", margin: "4px 0 0", fontFamily: "'Inter', sans-serif" }}>
                {movie.year} · {movie.genre}
              </p>
            </div>
            <div style={{ display: "flex", gap: "16px", fontFamily: "'Inter', sans-serif", fontSize: "13px", color: colors.text }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Star size={14} fill="#FFD166" stroke="none" />
                {movie.rating}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", color: colors.muted }}>
                <Clock size={14} />
                {movie.runtime_minutes ? `${movie.runtime_minutes} min` : "Runtime unknown"}
              </div>
            </div>

            {hasAnyProvider && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                {flatrate.slice(0, 3).map((p) => (
                  <span
                    key={`flat-${p.name}`}
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 9px",
                      borderRadius: "20px",
                      background: colors.orange,
                      color: "#15131A",
                    }}
                  >
                    {p.name}
                  </span>
                ))}
                {flatrate.length === 0 &&
                  rentOrBuyUnique.slice(0, 2).map((p) => (
                    <span
                      key={`rb-${p.name}`}
                      style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: "11px",
                        fontWeight: 500,
                        padding: "3px 9px",
                        borderRadius: "20px",
                        border: `1px solid ${colors.border}`,
                        color: colors.muted,
                      }}
                    >
                      {p.name}
                    </span>
                  ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MatchScreen({ movie, onGoHome }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingTop: "max(24px, calc(env(safe-area-inset-top) + 16px))",
        paddingBottom: "max(24px, calc(env(safe-area-inset-bottom) + 16px))",
        boxSizing: "border-box",
        fontFamily: "'Inter', sans-serif",
        textAlign: "center",
        position: "relative",
      }}
    >
      <HomeButton onClick={onGoHome} style={{ position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px" }} />

      <p style={{ color: colors.orange, fontFamily: "'Archivo Black', sans-serif", fontSize: "16px", letterSpacing: "2px", marginBottom: "8px" }}>
        IT'S A MATCH
      </p>
      <div style={{ width: "220px", height: "340px", marginBottom: "20px", position: "relative" }}>
        <MovieCard movie={movie} isTop={false} dragX={0} dragRotate={0} flipped={false} onToggleFlip={() => {}} />
      </div>
      <h2 style={{ color: colors.text, fontFamily: "'Archivo Black', sans-serif", fontSize: "22px", textTransform: "uppercase" }}>
        {movie.title}
      </h2>
      <p style={{ color: colors.muted, fontSize: "14px", marginTop: "4px", marginBottom: "24px" }}>Everyone agreed — go press play.</p>

      <button
        onClick={onGoHome}
        style={{
          padding: "12px 24px",
          borderRadius: "10px",
          border: "none",
          background: colors.orange,
          color: "#15131A",
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: "13px",
          letterSpacing: "0.5px",
          cursor: "pointer",
        }}
      >
        START A NEW ROOM
      </button>
    </div>
  );
}

function NoMatchScreen({ leaderboard, onGoHome }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        paddingTop: "max(24px, calc(env(safe-area-inset-top) + 16px))",
        paddingBottom: "max(24px, calc(env(safe-area-inset-bottom) + 16px))",
        boxSizing: "border-box",
        fontFamily: "'Inter', sans-serif",
        textAlign: "center",
        position: "relative",
      }}
    >
      <HomeButton onClick={onGoHome} style={{ position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px" }} />

      <p style={{ color: colors.text, fontFamily: "'Archivo Black', sans-serif", fontSize: "20px", marginBottom: "8px" }}>
        NO UNANIMOUS PICK
      </p>
      <p style={{ color: colors.muted, fontSize: "14px", marginBottom: "24px" }}>
        Here's what got the most votes — settle it from here.
      </p>
      <div style={{ width: "100%", maxWidth: "320px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
        {leaderboard.map((entry, i) => (
          <div
            key={entry.movie.id}
            style={{
              background: colors.surface,
              borderRadius: "12px",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <p style={{ color: colors.text, fontSize: "15px", margin: 0, fontWeight: 600 }}>
                {i + 1}. {entry.movie.title}
              </p>
              <p style={{ color: colors.muted, fontSize: "12px", margin: "2px 0 0" }}>
                {entry.movie.year} · {entry.movie.genre}
              </p>
            </div>
            <p style={{ color: colors.orange, fontSize: "14px", fontWeight: 600, margin: 0 }}>
              {entry.votes} {entry.votes === 1 ? "vote" : "votes"}
            </p>
          </div>
        ))}
      </div>

      <button
        onClick={onGoHome}
        style={{
          padding: "12px 24px",
          borderRadius: "10px",
          border: "none",
          background: colors.orange,
          color: "#15131A",
          fontFamily: "'Archivo Black', sans-serif",
          fontSize: "13px",
          letterSpacing: "0.5px",
          cursor: "pointer",
        }}
      >
        START A NEW ROOM
      </button>
    </div>
  );
}

export default function MovieSwipe({ deck, activeCount, participants, match, noMatch, onSwipe, onGoHome }) {
  const [localDeck, setLocalDeck] = useState(deck);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const startX = useRef(0);

  if (match) return <MatchScreen movie={match} onGoHome={onGoHome} />;
  if (noMatch) return <NoMatchScreen leaderboard={noMatch} onGoHome={onGoHome} />;

  const handleLeave = () => {
    if (window.confirm("Leave this room? You'll lose your spot in the deck.")) {
      onGoHome();
    }
  };

  const handleStart = (clientX) => {
    setIsDragging(true);
    startX.current = clientX;
  };

  const handleMove = (clientX) => {
    if (!isDragging) return;
    setDragX(clientX - startX.current);
  };

  const handleEnd = () => {
    setIsDragging(false);
    if (dragX > 100) {
      commitSwipe("right");
    } else if (dragX < -100) {
      commitSwipe("left");
    } else {
      setDragX(0);
    }
  };

  const commitSwipe = (direction) => {
    const current = localDeck[0];
    if (!current) return;
    onSwipe(current.id, direction);
    setDragX(direction === "right" ? 500 : -500);
    setTimeout(() => {
      setLocalDeck((prev) => prev.slice(1));
      setDragX(0);
      setFlipped(false); // next card always starts poster-side up
    }, 200);
  };

  const topMovie = localDeck[0];
  const nextMovie = localDeck[1];
  const rotate = dragX / 20;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
        paddingTop: "max(32px, calc(env(safe-area-inset-top) + 16px))",
        paddingBottom: "max(32px, calc(env(safe-area-inset-bottom) + 16px))",
        boxSizing: "border-box",
        fontFamily: "'Inter', sans-serif",
        overscrollBehavior: "none",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600&display=swap');
        html, body {
          overscroll-behavior: none;
          touch-action: manipulation;
        }
      `}</style>

      <HomeButton
        onClick={handleLeave}
        style={{ position: "absolute", top: "max(32px, calc(env(safe-area-inset-top) + 16px))", left: "16px" }}
      />

      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h1
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            color: colors.text,
            fontSize: "26px",
            margin: 0,
            letterSpacing: "1px",
          }}
        >
          MOVIE NIGHT
        </h1>
        <p style={{ color: colors.muted, fontSize: "14px", marginTop: "6px" }}>
          {activeCount} {activeCount === 1 ? "person" : "people"} in the room ·{" "}
          {localDeck.length > 0 ? `${localDeck.length} left` : "deck finished"}
        </p>
        {participants.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px", marginTop: "10px" }}>
            {participants.map((p) => (
              <span
                key={p.id}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11px",
                  fontWeight: 500,
                  padding: "3px 10px",
                  borderRadius: "20px",
                  border: `1px solid ${p.connected ? colors.orange : colors.border}`,
                  color: p.connected ? colors.text : colors.muted,
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: "relative", width: "100%", maxWidth: "340px", height: "540px" }}>
        {localDeck.length === 0 ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "20px",
              border: `2px dashed ${colors.border}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: colors.text, fontSize: "18px", fontFamily: "'Archivo Black', sans-serif" }}>
              WAITING ON THE GROUP
            </p>
            <p style={{ color: colors.muted, fontSize: "14px" }}>
              You've swiped everything — hang tight for the others to finish.
            </p>
          </div>
        ) : (
          <>
            {nextMovie && <MovieCard movie={nextMovie} isTop={false} dragX={0} dragRotate={0} flipped={false} onToggleFlip={() => {}} />}
            {topMovie && (
              <div
                onMouseDown={(e) => !flipped && handleStart(e.clientX)}
                onMouseMove={(e) => !flipped && handleMove(e.clientX)}
                onMouseUp={() => !flipped && handleEnd()}
                onMouseLeave={() => !flipped && isDragging && handleEnd()}
                onTouchStart={(e) => !flipped && handleStart(e.touches[0].clientX)}
                onTouchMove={(e) => {
                  if (flipped) return;
                  e.preventDefault(); // stop the page from panning/scrolling while dragging the card
                  handleMove(e.touches[0].clientX);
                }}
                onTouchEnd={() => !flipped && handleEnd()}
                style={{ position: "absolute", inset: 0, touchAction: "none" }}
              >
                <MovieCard
                  movie={topMovie}
                  isTop={true}
                  dragX={dragX}
                  dragRotate={rotate}
                  flipped={flipped}
                  onToggleFlip={() => setFlipped((f) => !f)}
                />
              </div>
            )}
          </>
        )}
      </div>

      {localDeck.length > 0 && (
        <div style={{ display: "flex", gap: "24px", marginTop: "32px", opacity: flipped ? 0.3 : 1, transition: "opacity 0.2s" }}>
          <button
            onClick={() => !flipped && commitSwipe("left")}
            disabled={flipped}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: `2px solid ${colors.blue}`,
              background: "transparent",
              color: colors.blue,
              fontSize: "24px",
              cursor: flipped ? "default" : "pointer",
            }}
          >
            ✕
          </button>
          <button
            onClick={() => !flipped && commitSwipe("right")}
            disabled={flipped}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              border: `2px solid ${colors.orange}`,
              background: "transparent",
              color: colors.orange,
              fontSize: "22px",
              cursor: flipped ? "default" : "pointer",
            }}
          >
            ♥
          </button>
        </div>
      )}
    </div>
  );
}
