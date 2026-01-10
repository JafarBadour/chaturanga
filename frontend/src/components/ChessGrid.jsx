import React, { useState } from "react";
import "./ChessGrid.css";

const ChessGrid = () => {
  const [currentMode, setCurrentMode] = useState(null);

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
    { time: "Custom", label: "" },
  ];

  return (
    <div className="chess-container">
      <div className="chess-grid">
        {timeControls.map((control, index) => (
          <button
            key={index}
            className={`grid-button ${
              currentMode === control.time ? "active" : ""
            }`}
            onClick={() => setCurrentMode(control.time)}
          >
            <span className="time-text">{control.time}</span>
            {control.label && (
              <span className="label-text">{control.label}</span>
            )}
          </button>
        ))}
      </div>
      <p style={{ color: "#fff", marginTop: "10px" }}>
        Selected: {currentMode || "None"}
      </p>
    </div>
  );
};

export default ChessGrid;
