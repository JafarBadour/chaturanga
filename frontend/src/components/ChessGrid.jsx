import React from "react";
import "./ChessGrid.css";

const timeControls = [
  { time: "1+0", label: "Bullet" },
  { time: "2+1", label: "Bullet" },
  { time: "3+0", label: "Blitz" },
  { time: "3+2", label: "Blitz" },
  { time: "5+0", label: "Blitz" },
  { time: "5+3", label: "Blitz" },
  { time: "10+0", label: "Rapid" },
  { time: "10+5", label: "Rapid" },
  { time: "15+10", label: "Rapid" },
  { time: "30+0", label: "Classical" },
  { time: "30+20", label: "Classical" },
];

function KnightWatermark() {
  return (
    <svg
      className="chess-grid-watermark"
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
  );
}

const ChessGrid = ({ seekingMode = null, onSelect, variant = "default" }) => {
  const isHero = variant === "hero";

  const grid = (
    <div className="chess-grid">
      {timeControls.map((control) => {
        const isSeeking = seekingMode === control.time;
        return (
          <button
            key={control.time}
            type="button"
            className={`grid-button ${isSeeking ? "seeking" : ""} ${
              seekingMode && !isSeeking ? "dimmed" : ""
            }`}
            onClick={() => onSelect?.(control.time)}
            aria-pressed={isSeeking}
          >
            {isSeeking ? (
              <>
                <span className="seek-spinner" aria-hidden="true" />
                <span className="seek-cancel-label">Cancel</span>
              </>
            ) : (
              <>
                <span className="time-text">{control.time}</span>
                {control.label && <span className="label-text">{control.label}</span>}
              </>
            )}
          </button>
        );
      })}
      <button type="button" className="grid-button custom-button" disabled aria-disabled="true">
        <span className="time-text">Custom</span>
      </button>
    </div>
  );

  if (isHero) {
    return (
      <div className="chess-container chess-hero">
        <div className="chess-grid-wrap">
          <KnightWatermark />
          {grid}
        </div>
      </div>
    );
  }

  return <div className="chess-container">{grid}</div>;
};

export default ChessGrid;
