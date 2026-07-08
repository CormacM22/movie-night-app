import { useState, useEffect } from "react";
import { createSession, joinSession, fetchGenres } from "./api";

const colors = {
  bg: "#15131A",
  surface: "#1F1B26",
  text: "#F2EFE9",
  muted: "#8B8594",
  orange: "#FF6B4A",
  blue: "#4AC9FF",
  border: "#3A3640",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  border: `1px solid ${colors.border}`,
  background: colors.surface,
  color: colors.text,
  fontSize: "16px",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  boxSizing: "border-box",
};

const buttonStyle = (bg, disabled = false) => ({
  width: "100%",
  padding: "13px",
  borderRadius: "10px",
  border: "none",
  background: bg,
  color: "#15131A",
  fontFamily: "'Archivo Black', sans-serif",
  fontSize: "14px",
  letterSpacing: "0.5px",
  cursor: disabled ? "default" : "pointer",
  marginTop: "10px",
  opacity: disabled ? 0.4 : 1,
});

const chipStyle = (selected) => ({
  padding: "8px 14px",
  borderRadius: "20px",
  border: `1px solid ${selected ? colors.orange : colors.border}`,
  background: selected ? colors.orange : "transparent",
  color: selected ? "#15131A" : colors.text,
  fontFamily: "'Inter', sans-serif",
  fontSize: "13px",
  fontWeight: selected ? 600 : 400,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

export default function Lobby({ onJoined }) {
  const [mode, setMode] = useState("choose"); // choose | create | join
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [createdCode, setCreatedCode] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [genres, setGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null); // null = any genre
  const [selectedThreshold, setSelectedThreshold] = useState(1.0);

  useEffect(() => {
    fetchGenres().then(setGenres);
  }, []);

  const completeJoin = async (roomCode) => {
    if (!name.trim()) {
      setError("Enter your name first");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { participant_id, deck, participant_count } = await joinSession(
        roomCode.toUpperCase().trim(),
        name.trim()
      );
      onJoined({ code: roomCode.toUpperCase().trim(), participantId: participant_id, deck, participantCount: participant_count });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    setError("");
    try {
      const { code: newCode } = await createSession(selectedThreshold, selectedGenre);
      setCreatedCode(newCode);
    } catch (err) {
      setError("Could not reach the server — is the backend running?");
    } finally {
      setLoading(false);
    }
  };

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
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600&display=swap');
      `}</style>

      <h1
        style={{
          fontFamily: "'Archivo Black', sans-serif",
          color: colors.text,
          fontSize: "28px",
          letterSpacing: "1px",
          marginBottom: "32px",
        }}
      >
        MOVIE NIGHT
      </h1>

      <div style={{ width: "100%", maxWidth: "320px" }}>
        {mode === "choose" && (
          <>
            <button style={buttonStyle(colors.orange)} onClick={() => setMode("create")}>
              START A ROOM
            </button>
            <button style={buttonStyle(colors.blue)} onClick={() => setMode("join")}>
              JOIN A ROOM
            </button>
          </>
        )}

        {mode === "create" && !createdCode && (
          <>
            <input
              style={inputStyle}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            {genres.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <p style={{ color: colors.muted, fontSize: "12px", letterSpacing: "1px", marginBottom: "8px" }}>
                  GENRE (OPTIONAL)
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={chipStyle(selectedGenre === null)} onClick={() => setSelectedGenre(null)}>
                    Any genre
                  </span>
                  {genres.map((g) => (
                    <span
                      key={g.id}
                      style={chipStyle(selectedGenre === g.id)}
                      onClick={() => setSelectedGenre(selectedGenre === g.id ? null : g.id)}
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: "16px" }}>
              <p style={{ color: colors.muted, fontSize: "12px", letterSpacing: "1px", marginBottom: "8px" }}>
                MATCH WHEN
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { label: "MAJORITY", value: 0.5 },
                  { label: "MOST", value: 0.75 },
                  { label: "EVERYONE", value: 1.0 },
                ].map(({ label, value }) => (
                  <span
                    key={value}
                    style={chipStyle(selectedThreshold === value)}
                    onClick={() => setSelectedThreshold(value)}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <button
              style={buttonStyle(colors.orange, !name.trim() || loading)}
              onClick={handleCreate}
              disabled={!name.trim() || loading}
            >
              {loading ? "CREATING..." : "CREATE ROOM"}
            </button>
            <button
              style={{ ...buttonStyle("transparent"), color: colors.muted, border: `1px solid ${colors.border}` }}
              onClick={() => {
                setError("");
                setMode("choose");
              }}
            >
              BACK
            </button>
          </>
        )}

        {mode === "create" && createdCode && (
          <div style={{ textAlign: "center" }}>
            <p style={{ color: colors.muted, fontSize: "13px", marginBottom: "6px" }}>
              SHARE THIS CODE WITH YOUR FRIENDS
            </p>
            <p
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                color: colors.orange,
                fontSize: "40px",
                letterSpacing: "4px",
                margin: "0 0 24px",
              }}
            >
              {createdCode}
            </p>
            <button
              style={buttonStyle(colors.orange, loading)}
              onClick={() => completeJoin(createdCode)}
              disabled={loading}
            >
              {loading ? "JOINING..." : "ENTER ROOM"}
            </button>
            <button
              style={{ ...buttonStyle("transparent"), color: colors.muted, border: `1px solid ${colors.border}` }}
              onClick={() => {
                setCreatedCode(null);
                setError("");
                setMode("choose");
              }}
            >
              BACK
            </button>
          </div>
        )}

        {mode === "join" && (
          <>
            <input
              style={{ ...inputStyle, marginBottom: "12px" }}
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: "2px" }}
              placeholder="Room code"
              value={code}
              maxLength={4}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              style={buttonStyle(colors.blue, !name.trim() || !code.trim() || loading)}
              onClick={() => completeJoin(code)}
              disabled={!name.trim() || !code.trim() || loading}
            >
              {loading ? "JOINING..." : "JOIN"}
            </button>
            <button
              style={{ ...buttonStyle("transparent"), color: colors.muted, border: `1px solid ${colors.border}` }}
              onClick={() => {
                setError("");
                setMode("choose");
              }}
            >
              BACK
            </button>
          </>
        )}

        {error && (
          <p style={{ color: colors.orange, fontSize: "13px", marginTop: "14px", textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
