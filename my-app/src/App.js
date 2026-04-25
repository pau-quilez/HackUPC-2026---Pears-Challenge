import { useState } from "react";

// ── Palette ────────────────────────────────────────────────────────────────────
const PLAYER_COLORS = [
  { name: "rose",    active: "#f43f5e", bg: "#fff1f2", border: "#fda4af", glow: "rgba(244,63,94,0.4)"   },
  { name: "emerald", active: "#10b981", bg: "#ecfdf5", border: "#6ee7b7", glow: "rgba(16,185,129,0.4)"  },
  { name: "amber",   active: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", glow: "rgba(245,158,11,0.4)"  },
  { name: "sky",     active: "#0ea5e9", bg: "#f0f9ff", border: "#7dd3fc", glow: "rgba(14,165,233,0.4)"  },
];

function initialTiles() {
  return Array.from({ length: 12 }, (_, i) => ({ id: i + 1, eliminated: false }));
}

function initialPlayers(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Player ${i + 1}`,
    tiles: initialTiles(),
  }));
}

// ── Tile ───────────────────────────────────────────────────────────────────────
function Tile({ number, eliminated, isCurrentTurn, isSelected, isSelectable, color, onClick }) {
  let bg = "#ffffff";
  let borderColor = "#e5e7eb";
  let textColor = "#374151";
  let shadow = "0 1px 3px rgba(0,0,0,0.08)";
  let cursor = "default";
  let scale = 1;

  if (eliminated) {
    bg = "#e5e7eb";
    borderColor = "#d1d5db";
    textColor = "#9ca3af";
    shadow = "none";
    scale = 0.88;
  } else if (isSelected) {
    bg = color.active;
    borderColor = color.active;
    textColor = "#fff";
    shadow = `0 0 0 3px ${color.glow}, 0 4px 12px ${color.glow}`;
    scale = 1.1;
    cursor = "pointer";
  } else if (isSelectable) {
    bg = color.bg;
    borderColor = color.border;
    textColor = color.active;
    shadow = `0 2px 6px ${color.glow}`;
    cursor = "pointer";
  }

  return (
    <div
      onClick={isSelectable || isSelected ? onClick : undefined}
      style={{
        width: 38,
        height: 44,
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Mono', monospace",
        fontWeight: 700,
        fontSize: 15,
        transition: "all 0.22s cubic-bezier(.4,0,.2,1)",
        background: bg,
        color: textColor,
        border: `2px solid ${borderColor}`,
        boxShadow: shadow,
        transform: `scale(${scale})`,
        cursor,
        userSelect: "none",
        textDecoration: eliminated ? "line-through" : "none",
      }}
    >
      {number}
    </div>
  );
}

// ── Player Board ───────────────────────────────────────────────────────────────
function PlayerBoard({ player, isCurrentTurn, color, phase, selectedTiles, onTileClick, lastRoll }) {
  const remaining = player.tiles.filter((t) => !t.eliminated).reduce((s, t) => s + t.id, 0);
  const selectedSum = selectedTiles.reduce((s, id) => s + id, 0);
  const isSelectionPhase = isCurrentTurn && phase === "selecting";

  return (
    <div
      style={{
        borderRadius: 20,
        padding: "20px 22px",
        background: color.bg,
        border: `2px solid ${isCurrentTurn ? color.active : color.border}`,
        boxShadow: isCurrentTurn
          ? `0 0 0 4px ${color.glow}, 0 8px 32px ${color.glow}`
          : "0 2px 12px rgba(0,0,0,0.06)",
        transition: "all 0.4s cubic-bezier(.4,0,.2,1)",
        position: "relative",
        flex: 1,
        minWidth: 264,
        animation: isCurrentTurn ? "pulseGlow 2.2s ease-in-out infinite" : "none",
      }}
    >
      {/* Turn badge */}
      {isCurrentTurn && (
        <div style={{
          position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
          background: color.active, color: "#fff", fontSize: 10, fontWeight: 700,
          fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em",
          padding: "3px 14px", borderRadius: 99, whiteSpace: "nowrap",
          boxShadow: `0 2px 8px ${color.glow}`,
        }}>
          {phase === "rolling" ? "ROLL NOW" : "SELECT TILES"}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{
          fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 18,
          color: isCurrentTurn ? color.active : "#374151", transition: "color 0.3s",
        }}>
          {player.name}
        </span>
        <span style={{
          fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 12,
          color: color.active, background: `${color.active}18`, padding: "3px 10px", borderRadius: 8,
        }}>
          {remaining === 0 ? "🏆 SHUT!" : `${remaining} pts`}
        </span>
      </div>

      {/* Tiles */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {player.tiles.map((tile) => {
          const isSelected = selectedTiles.includes(tile.id);
          const isSelectable = isSelectionPhase && !tile.eliminated;
          return (
            <Tile
              key={tile.id}
              number={tile.id}
              eliminated={tile.eliminated}
              isCurrentTurn={isCurrentTurn}
              isSelected={isSelected}
              isSelectable={isSelectable}
              color={color}
              onClick={() => onTileClick(tile.id)}
            />
          );
        })}
      </div>

      {/* Live selection feedback */}
      {isSelectionPhase && lastRoll && (
        <div style={{
          marginTop: 12, fontFamily: "'DM Mono', monospace", fontSize: 12,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ color: "#6b7280" }}>
            Sum: <strong style={{ color: color.active }}>{selectedSum}</strong>
            <span style={{ opacity: 0.4 }}> / </span>
            <strong>{lastRoll.sum}</strong>
          </span>
          {selectedSum === lastRoll.sum && (
            <span style={{
              background: color.active, color: "#fff", fontSize: 10, fontWeight: 700,
              padding: "2px 8px", borderRadius: 6, letterSpacing: "0.08em",
            }}>✓ VALID</span>
          )}
          {selectedSum > lastRoll.sum && (
            <span style={{
              background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700,
              padding: "2px 8px", borderRadius: 6,
            }}>TOO HIGH</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Game ──────────────────────────────────────────────────────────────────
export default function ShutTheBox() {
  const [playerCount, setPlayerCount] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [phase, setPhase] = useState("rolling"); // "rolling" | "selecting"
  const [lastRoll, setLastRoll] = useState(null);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState("");

  // ── Replace with your P2P roll function ───────────────────────────────────
  function rollDice() {
    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    return { dice: [d1, d2], sum: d1 + d2 };
  }

  function handleRoll() {
    if (rolling || phase !== "rolling" || gameOver) return;
    setRolling(true);
    setError("");
    setTimeout(() => {
      const roll = rollDice();
      setLastRoll(roll);
      setSelectedTiles([]);
      setPhase("selecting");
      setRolling(false);
    }, 400);
  }

  function handleTileClick(tileId) {
    if (phase !== "selecting") return;
    setError("");
    setSelectedTiles((prev) => {
      if (prev.includes(tileId)) return prev.filter((id) => id !== tileId);
      const next = [...prev, tileId];
      const sum = next.reduce((s, id) => s + id, 0);
      if (sum > lastRoll.sum) {
        setError(`Selected sum exceeds ${lastRoll.sum} — deselect a tile first.`);
        return prev;
      }
      return next;
    });
  }

  function handleConfirm() {
    const selectedSum = selectedTiles.reduce((s, id) => s + id, 0);
    if (selectedSum !== lastRoll.sum) {
      setError(`Tiles must sum to exactly ${lastRoll.sum}.`);
      return;
    }

    const toEliminate = new Set(selectedTiles);

    setPlayers((prev) => {
      const next = prev.map((p, idx) => {
        if (idx !== currentPlayerIdx) return p;
        return {
          ...p,
          tiles: p.tiles.map((t) =>
            toEliminate.has(t.id) ? { ...t, eliminated: true } : t
          ),
        };
      });

      const updated = next[currentPlayerIdx];
      const stillOpen = updated.tiles.filter((t) => !t.eliminated);
      if (stillOpen.length === 0) {
        setGameOver(true);
      } else {
        setCurrentPlayerIdx((currentPlayerIdx + 1) % prev.length);
        setPhase("rolling");
        setLastRoll(null);
        setSelectedTiles([]);
      }

      return next;
    });

    setError("");
  }

  function handleSkip() {
    setCurrentPlayerIdx((currentPlayerIdx + 1) % players.length);
    setPhase("rolling");
    setLastRoll(null);
    setSelectedTiles([]);
    setError("");
  }

  function resetGame() {
    setPlayers(initialPlayers(playerCount));
    setCurrentPlayerIdx(0);
    setPhase("rolling");
    setLastRoll(null);
    setSelectedTiles([]);
    setGameOver(false);
    setError("");
  }

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (playerCount === null) {
    return (
      <div style={styles.root}>
        <style>{globalStyles}</style>
        <div style={styles.setupCard}>
          <h1 style={styles.title}>Shut the Box</h1>
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, letterSpacing: "0.2em", color: "#9ca3af", margin: "4px 0 32px", textTransform: "uppercase" }}>
            P2P Edition
          </p>
          <p style={{ fontFamily: "'DM Mono', monospace", color: "#6b7280", marginBottom: 24, fontSize: 13 }}>
            Select number of players
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => { setPlayerCount(n); setPlayers(initialPlayers(n)); }}
                style={styles.playerCountBtn}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────────
  const currentPlayer = players[currentPlayerIdx];
  const color = PLAYER_COLORS[currentPlayerIdx % PLAYER_COLORS.length];
  const selectedSum = selectedTiles.reduce((s, id) => s + id, 0);
  const isValidSelection = lastRoll && selectedSum === lastRoll.sum;

  const topPlayers = players.slice(0, 2);
  const botPlayers = players.slice(2, 4);

  return (
    <div style={styles.root}>
      <style>{globalStyles}</style>

      <h1 style={{ ...styles.title, fontSize: 26, marginBottom: 20 }}>Shut the Box</h1>

      {/* HUD */}
      <div style={styles.hud}>
        {/* Roll display */}
        <div style={styles.hudSection}>
          <span style={styles.hudLabel}>{lastRoll ? "ROLLED" : "AWAITING ROLL"}</span>
          {lastRoll ? (
            <span style={styles.hudValue}>
              {lastRoll.dice[0]}
              <span style={{ opacity: 0.35, margin: "0 5px", fontWeight: 400 }}>+</span>
              {lastRoll.dice[1]}
              <span style={{ opacity: 0.35, margin: "0 5px", fontWeight: 400 }}>=</span>
              <span style={{ color: color.active }}>{lastRoll.sum}</span>
            </span>
          ) : (
            <span style={{ ...styles.hudValue, opacity: 0.25 }}>—</span>
          )}
        </div>

        <div style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch" }} />

        {/* Action */}
        <div style={styles.hudSection}>
          {!gameOver ? (
            phase === "rolling" ? (
              <button
                onClick={handleRoll}
                disabled={rolling}
                style={{
                  ...styles.actionBtn,
                  background: rolling ? "#d1d5db" : color.active,
                  boxShadow: rolling ? "none" : `0 4px 20px ${color.glow}`,
                  cursor: rolling ? "not-allowed" : "pointer",
                }}
              >
                {rolling ? "Rolling…" : `Roll — ${currentPlayer?.name}`}
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                <button
                  onClick={handleConfirm}
                  disabled={!isValidSelection}
                  style={{
                    ...styles.actionBtn,
                    background: isValidSelection ? color.active : "#e5e7eb",
                    color: isValidSelection ? "#fff" : "#9ca3af",
                    boxShadow: isValidSelection ? `0 4px 20px ${color.glow}` : "none",
                    cursor: isValidSelection ? "pointer" : "not-allowed",
                    fontSize: 13,
                  }}
                >
                  Confirm Selection
                </button>
                <button onClick={handleSkip} style={styles.skipBtn}>
                  No valid move — Skip turn
                </button>
              </div>
            )
          ) : (
            <button onClick={resetGame} style={{ ...styles.actionBtn, background: "#1f2937", cursor: "pointer" }}>
              Play Again
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <div style={styles.errorBanner}>{error}</div>}

      {/* Game over */}
      {gameOver && (
        <div style={{ ...styles.errorBanner, background: "#ecfdf5", border: "1.5px solid #6ee7b7", color: "#065f46" }}>
          🏆 {currentPlayer?.name} shut the box!
        </div>
      )}

      {/* Boards */}
      <div style={styles.grid}>
        <div style={styles.row}>
          {topPlayers.map((p) => (
            <PlayerBoard
              key={p.id}
              player={p}
              isCurrentTurn={!gameOver && p.id === currentPlayerIdx}
              color={PLAYER_COLORS[p.id]}
              phase={phase}
              selectedTiles={p.id === currentPlayerIdx ? selectedTiles : []}
              onTileClick={handleTileClick}
              lastRoll={lastRoll}
            />
          ))}
        </div>
        {botPlayers.length > 0 && (
          <div style={styles.row}>
            {botPlayers.map((p) => (
              <PlayerBoard
                key={p.id}
                player={p}
                isCurrentTurn={!gameOver && p.id === currentPlayerIdx}
                color={PLAYER_COLORS[p.id]}
                phase={phase}
                selectedTiles={p.id === currentPlayerIdx ? selectedTiles : []}
                onTileClick={handleTileClick}
                lastRoll={lastRoll}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #fdf6ec 0%, #f0f4ff 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "28px 20px",
  },
  setupCard: {
    background: "#fff",
    borderRadius: 24,
    padding: "48px 56px",
    boxShadow: "0 8px 48px rgba(0,0,0,0.10)",
    textAlign: "center",
    border: "1.5px solid #e5e7eb",
  },
  title: {
    fontFamily: "'Playfair Display', serif",
    fontWeight: 900,
    fontSize: 36,
    color: "#1f2937",
    margin: 0,
    letterSpacing: "-0.02em",
  },
  hud: {
    display: "flex",
    alignItems: "center",
    gap: 24,
    background: "#fff",
    border: "1.5px solid #e5e7eb",
    borderRadius: 18,
    padding: "16px 28px",
    marginBottom: 14,
    boxShadow: "0 2px 16px rgba(0,0,0,0.07)",
    minWidth: 360,
  },
  hudSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  hudLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 9,
    letterSpacing: "0.18em",
    color: "#9ca3af",
    fontWeight: 700,
  },
  hudValue: {
    fontFamily: "'DM Mono', monospace",
    fontWeight: 800,
    fontSize: 26,
    color: "#1f2937",
    letterSpacing: "-0.02em",
  },
  actionBtn: {
    fontFamily: "'DM Mono', monospace",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.03em",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 22px",
    transition: "all 0.2s cubic-bezier(.4,0,.2,1)",
    whiteSpace: "nowrap",
  },
  skipBtn: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    color: "#9ca3af",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
  errorBanner: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    fontWeight: 600,
    color: "#b91c1c",
    background: "#fef2f2",
    border: "1.5px solid #fca5a5",
    borderRadius: 10,
    padding: "8px 20px",
    marginBottom: 14,
    textAlign: "center",
  },
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    width: "100%",
    maxWidth: 740,
  },
  row: {
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  playerCountBtn: {
    fontFamily: "'Playfair Display', serif",
    fontWeight: 800,
    fontSize: 28,
    width: 72,
    height: 72,
    borderRadius: 18,
    border: "2px solid #e5e7eb",
    background: "#f9fafb",
    cursor: "pointer",
    transition: "all 0.2s",
    color: "#1f2937",
  },
};

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Mono:wght@400;500;700&display=swap');
  @keyframes pulseGlow {
    0%, 100% { box-shadow: 0 0 0 4px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06); }
    50%       { box-shadow: 0 0 0 7px rgba(0,0,0,0.08), 0 12px 40px rgba(0,0,0,0.08); }
  }
  button:not(:disabled):hover { filter: brightness(1.08); }
`;