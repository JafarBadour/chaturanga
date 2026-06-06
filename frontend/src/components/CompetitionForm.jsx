import React, { useState } from "react";
import { ROYALE_TIERS, toRoyaleTimeControl } from "./ChessRoyale";
import {
  DURATION_PRESETS,
  FORMATS,
  STANDARD_TIME_CONTROLS,
  emptyFormValues,
  minStartLocal,
} from "../utils/competitionForm";
import "../pages/CreateCompetitionPage.css";

export default function CompetitionForm({
  initialValues = emptyFormValues(),
  onSubmit,
  submitLabel,
  submitting = false,
  error = "",
}) {
  const [name, setName] = useState(initialValues.name);
  const [gameMode, setGameMode] = useState(initialValues.gameMode);
  const [format, setFormat] = useState(initialValues.format);
  const [timeControl, setTimeControl] = useState(initialValues.timeControl);
  const [startsAt, setStartsAt] = useState(initialValues.startsAt);
  const [isPublic, setIsPublic] = useState(initialValues.isPublic);
  const [maxParticipants, setMaxParticipants] = useState(initialValues.maxParticipants);
  const [minRating, setMinRating] = useState(initialValues.minRating);
  const [maxRating, setMaxRating] = useState(initialValues.maxRating);
  const [durationMinutes, setDurationMinutes] = useState(initialValues.durationMinutes);
  const [notes, setNotes] = useState(initialValues.notes);

  const handleModeChange = (mode) => {
    setGameMode(mode);
    setTimeControl(mode === "royale" ? toRoyaleTimeControl("7") : "5+0");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name,
      gameMode,
      format,
      timeControl,
      startsAt,
      isPublic,
      maxParticipants,
      minRating,
      maxRating,
      durationMinutes,
      notes,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <section className="create-comp-section">
        <h2>Basics</h2>
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Weekend Blitz Open"
            required
            maxLength={100}
          />
        </label>
      </section>

      <section className="create-comp-section">
        <h2>Mode</h2>
        <div className="create-comp-dock">
          <button
            type="button"
            className={`dock-btn${gameMode === "standard" ? " active" : ""}`}
            onClick={() => handleModeChange("standard")}
          >
            Standard
          </button>
          <button
            type="button"
            className={`dock-btn royale-active${gameMode === "royale" ? " active" : ""}`}
            onClick={() => handleModeChange("royale")}
          >
            Royale
          </button>
        </div>
        <p className="create-comp-hint">
          {gameMode === "royale"
            ? "Per-move timer. Miss twice and you forfeit — applies in FIFM matches too."
            : "Classic clocks with increment."}
        </p>
      </section>

      <section className="create-comp-section">
        <h2>Format</h2>
        <div className="create-comp-format-grid">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`format-card${format === f.id ? " active" : ""}`}
              onClick={() => setFormat(f.id)}
            >
              <span className="format-card-label">{f.label}</span>
              <span className="format-card-desc">{f.desc}</span>
            </button>
          ))}
        </div>
        {format === "fifm" && (
          <p className="create-comp-fifm-note">
            Players are matched immediately when both are available. Games use the normal
            grace period — no move means a strike; two strikes is a forfeit loss.
          </p>
        )}
      </section>

      <section className="create-comp-section">
        <h2>Time control</h2>
        {gameMode === "standard" ? (
          <div className="create-comp-tc-grid">
            {STANDARD_TIME_CONTROLS.map((tc) => (
              <button
                key={tc}
                type="button"
                className={`tc-btn${timeControl === tc ? " active" : ""}`}
                onClick={() => setTimeControl(tc)}
              >
                {tc}
              </button>
            ))}
          </div>
        ) : (
          <div className="create-comp-royale-tiers">
            {ROYALE_TIERS.map((tier) => (
              <div key={tier.label} className="royale-tier-row-form">
                <span className="royale-tier-name">{tier.label}</span>
                <div className="royale-tier-btns">
                  {tier.times.map((sec) => {
                    const tc = toRoyaleTimeControl(sec);
                    return (
                      <button
                        key={tc}
                        type="button"
                        className={`tc-btn${timeControl === tc ? " active" : ""}`}
                        onClick={() => setTimeControl(tc)}
                      >
                        {sec}s
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {format === "fifm" && (
        <section className="create-comp-section">
          <h2>Event duration</h2>
          <p className="create-comp-hint">How long the FIFM window stays open for matching</p>
          <div className="create-comp-dock duration-dock">
            {DURATION_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`dock-btn${Number(durationMinutes) === p.value ? " active" : ""}`}
                onClick={() => setDurationMinutes(String(p.value))}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label>
            Custom duration (minutes)
            <input
              type="number"
              min={5}
              max={10080}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              required
            />
          </label>
        </section>
      )}

      <section className="create-comp-section">
        <h2>Schedule & access</h2>
        <label>
          Start date & time
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            min={minStartLocal()}
            required
          />
        </label>

        <div className="create-comp-visibility">
          <span className="field-label">Visibility</span>
          <div className="create-comp-dock">
            <button
              type="button"
              className={`dock-btn${isPublic ? " active" : ""}`}
              onClick={() => setIsPublic(true)}
            >
              Public
            </button>
            <button
              type="button"
              className={`dock-btn${!isPublic ? " active" : ""}`}
              onClick={() => setIsPublic(false)}
            >
              Private
            </button>
          </div>
          <p className="create-comp-hint">
            Private competitions get a shareable invite link only the organizer can copy.
          </p>
        </div>
      </section>

      <section className="create-comp-section">
        <h2>Limits</h2>
        <div className="create-comp-limits-grid">
          <label>
            Max participants
            <input
              type="number"
              min={2}
              max={10000}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              placeholder="No limit"
            />
          </label>
          <label>
            Min Elo
            <input
              type="number"
              min={0}
              max={4000}
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              placeholder="Any"
            />
          </label>
          <label>
            Max Elo
            <input
              type="number"
              min={0}
              max={4000}
              value={maxRating}
              onChange={(e) => setMaxRating(e.target.value)}
              placeholder="Any"
            />
          </label>
        </div>
      </section>

      <section className="create-comp-section">
        <h2>Notes</h2>
        <label>
          Optional description
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Prize info, rules, etc."
            rows={3}
            maxLength={500}
          />
        </label>
      </section>

      {error && <p className="create-comp-error">{error}</p>}

      <button type="submit" className="create-comp-submit" disabled={submitting}>
        {submitting ? `${submitLabel}…` : submitLabel}
      </button>
    </form>
  );
}
