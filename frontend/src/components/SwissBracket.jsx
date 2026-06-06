import React from "react";
import { useNavigate } from "react-router-dom";
import "./SwissBracket.css";

function resultLabel(result) {
  if (result === "white") return "1-0";
  if (result === "black") return "0-1";
  if (result === "draw") return "½-½";
  return null;
}

function PlayerChip({ player, viewerUserId, compact }) {
  const isViewer = player.user_id === viewerUserId;
  return (
    <span
      className={`swiss-player${isViewer ? " is-viewer" : ""}${
        player.status !== "active" ? ` swiss-player-${player.status}` : ""
      }${compact ? " compact" : ""}`}
      title={
        player.status === "advanced"
          ? "Advanced"
          : player.status === "eliminated"
            ? "Eliminated"
            : undefined
      }
    >
      {player.username}
    </span>
  );
}

function SwissMatch({ match, viewerUserId, onOpenGame }) {
  const clickable = Boolean(match.match_id);
  const result = resultLabel(match.result);

  const handleClick = () => {
    if (match.match_id) onOpenGame(match.match_id);
  };

  return (
    <div
      className={`swiss-match swiss-match-${match.status}${clickable ? " clickable" : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <PlayerChip
        player={{
          user_id: match.white_user_id,
          username: match.white_username,
          status: "active",
        }}
        viewerUserId={viewerUserId}
        compact
      />
      <span className="swiss-match-vs">vs</span>
      <PlayerChip
        player={{
          user_id: match.black_user_id,
          username: match.black_username,
          status: "active",
        }}
        viewerUserId={viewerUserId}
        compact
      />
      {match.status === "active" && <span className="swiss-match-badge live">Live</span>}
      {match.status === "joining" && <span className="swiss-match-badge joining">Joining</span>}
      {match.status === "scheduled" && (
        <span className="swiss-match-badge scheduled">Offered</span>
      )}
      {result && <span className="swiss-match-result">{result}</span>}
    </div>
  );
}

export default function SwissBracket({ structure, viewerUserId }) {
  const navigate = useNavigate();

  if (!structure?.rounds?.length) return null;

  const openGame = (gameId) => navigate(`/game/${gameId}`);

  const slotsHint =
    structure.advance_slots != null
      ? `Top ${structure.advance_slots} advance`
      : null;

  return (
    <section className="swiss-bracket-section" aria-label="Swiss bracket">
      <div className="swiss-bracket-head">
        <h2>Swiss bracket</h2>
        <p className="swiss-bracket-rules">
          {structure.advance_wins} wins to advance · {structure.eliminate_losses} losses
          eliminated
          {slotsHint ? ` · ${slotsHint}` : ""}
        </p>
      </div>

      <div className="swiss-bracket-scroll">
        {structure.rounds.map((round) => (
          <div key={round.round} className="swiss-round-col">
            <div className="swiss-round-label">Round {round.round}</div>
            <div className="swiss-round-groups">
              {round.groups.map((group) => (
                <div
                  key={`${round.round}-${group.record}`}
                  className={`swiss-record-box swiss-record-${group.tone}`}
                >
                  <div className="swiss-record-header">
                    <span className="swiss-record-score">{group.record}</span>
                    {group.wins >= structure.advance_wins && (
                      <span className="swiss-record-tag advance">Advance</span>
                    )}
                    {group.losses >= structure.eliminate_losses && (
                      <span className="swiss-record-tag eliminated">Out</span>
                    )}
                  </div>
                  <div className="swiss-record-body">
                    {group.matches.map((match) => (
                      <SwissMatch
                        key={match.match_id || match.offer_id}
                        match={match}
                        viewerUserId={viewerUserId}
                        onOpenGame={openGame}
                      />
                    ))}
                    {group.players_idle.map((player) => (
                      <div key={player.user_id} className="swiss-idle-row">
                        <PlayerChip player={player} viewerUserId={viewerUserId} compact />
                        <span className="swiss-idle-label">waiting</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(structure.advanced.length > 0 || structure.eliminated.length > 0) && (
        <div className="swiss-bracket-footer">
          {structure.advanced.length > 0 && (
            <div className="swiss-status-block swiss-status-advanced">
              <span className="swiss-status-title">Advanced</span>
              <div className="swiss-status-chips">
                {structure.advanced.map((player) => (
                  <PlayerChip key={player.user_id} player={player} viewerUserId={viewerUserId} />
                ))}
              </div>
            </div>
          )}
          {structure.eliminated.length > 0 && (
            <div className="swiss-status-block swiss-status-eliminated">
              <span className="swiss-status-title">Eliminated</span>
              <div className="swiss-status-chips">
                {structure.eliminated.map((player) => (
                  <PlayerChip key={player.user_id} player={player} viewerUserId={viewerUserId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
