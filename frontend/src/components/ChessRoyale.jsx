import React from "react";
import "./ChessRoyale.css";

export const ROYALE_TIERS = [
  { label: "Bullet", times: ["1.5", "3", "5"] },
  { label: "Blitz", times: ["7", "11", "15"] },
  { label: "Rapid", times: ["20", "30", "45"] },
  { label: "Classical", times: ["60", "90"] },
];

export const toRoyaleTimeControl = (seconds) => `royale/${seconds}`;

const ChessRoyale = ({ seekingMode = null, onSelect, variant = "default" }) => {
  const isHero = variant === "hero";

  const content = (
    <>
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
                  type="button"
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
    </>
  );

  if (isHero) {
    return (
      <div className="royale-container royale-hero">
        <div className="royale-grid-wrap">
          <svg
            className="royale-grid-watermark"
            viewBox="0 0 45 45"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <g
              fill="none"
              fillRule="evenodd"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 10c10.5 1 16.5 8 16.5 19.5H25v-4h-4v4H5.5C5.5 18 11.5 11 22 10z" />
              <path d="M22 10V6M22 6h-4M22 6h4M12 29.5h20" />
            </g>
          </svg>
          <div className="royale-tiers">{content}</div>
        </div>
      </div>
    );
  }

  return <div className="royale-container">{content}</div>;
};

export default ChessRoyale;
