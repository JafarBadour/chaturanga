import React from "react";
import "./ChessRoyale.css";

export const ROYALE_TIERS = [
  { label: "Bullet", times: ["1.5", "3", "5"] },
  { label: "Blitz", times: ["7", "11", "15"] },
  { label: "Rapid", times: ["20", "30", "45"] },
];

export const toRoyaleTimeControl = (seconds) => `royale/${seconds}`;

const ChessRoyale = ({ seekingMode = null, onSelect }) => {
  return (
    <div className="royale-container">
      {ROYALE_TIERS.map((tier) => (
        <div key={tier.label} className="royale-tier">
          <span className="royale-tier-label">{tier.label}</span>
          <div className="royale-tier-row">
            {tier.times.map((seconds) => {
              const tc = toRoyaleTimeControl(seconds);
              const isSeeking = seekingMode === tc;
              return (
                <button
                  key={tc}
                  className={`royale-button ${isSeeking ? "seeking" : ""} ${
                    seekingMode && !isSeeking ? "dimmed" : ""
                  }`}
                  onClick={() => onSelect?.(tc)}
                  aria-pressed={isSeeking}
                >
                  {isSeeking ? (
                    <>
                      <span className="seek-spinner" aria-hidden="true" />
                      <span className="seek-cancel-label">Cancel</span>
                    </>
                  ) : (
                    <>
                      <span className="royale-time">{seconds}</span>
                      <span className="royale-unit">sec / move</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ChessRoyale;
