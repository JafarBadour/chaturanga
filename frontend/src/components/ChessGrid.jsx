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

const ChessGrid = ({ seekingMode = null, onSelect }) => {
  return (
    <div className="chess-container">
      <div className="chess-grid">
        {timeControls.map((control) => {
          const isSeeking = seekingMode === control.time;
          return (
            <button
              key={control.time}
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
                  {control.label && (
                    <span className="label-text">{control.label}</span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChessGrid;
