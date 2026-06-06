import React, { useRef, useEffect } from "react";
import { getPlayPairingCells } from "./playPairingCells";
import "./PlayPairingGrid.css";

const ROYALE_ANIM_DURATION_MS = 6000;

function useSyncOffset(wrapRef, enabled) {
  useEffect(() => {
    if (!enabled || !wrapRef.current) return;
    // Negative delay snaps every element to the same point in the cycle
    const offsetMs = performance.now() % ROYALE_ANIM_DURATION_MS;
    wrapRef.current.style.setProperty("--royale-sync", `-${offsetMs.toFixed(0)}ms`);
  }, [enabled, wrapRef]);
}

function SwordLeft() {
  return (
    <svg
      className="bg-deco bg-deco-sword-left"
      viewBox="0 0 100 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* blade */}
      <polygon points="50,10 56,340 50,360 44,340" fill="currentColor" opacity="0.9" />
      {/* fuller (groove) */}
      <rect x="48.5" y="20" width="3" height="300" fill="currentColor" opacity="0.4" />
      {/* crossguard */}
      <rect x="10" y="340" width="80" height="14" rx="4" fill="currentColor" />
      {/* grip */}
      <rect x="44" y="354" width="12" height="32" rx="3" fill="currentColor" opacity="0.8" />
      {/* pommel */}
      <ellipse cx="50" cy="392" rx="10" ry="8" fill="currentColor" />
    </svg>
  );
}

function SwordRight() {
  return (
    <svg
      className="bg-deco bg-deco-sword-right"
      viewBox="0 0 100 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <polygon points="50,10 56,340 50,360 44,340" fill="currentColor" opacity="0.9" />
      <rect x="48.5" y="20" width="3" height="300" fill="currentColor" opacity="0.4" />
      <rect x="10" y="340" width="80" height="14" rx="4" fill="currentColor" />
      <rect x="44" y="354" width="12" height="32" rx="3" fill="currentColor" opacity="0.8" />
      <ellipse cx="50" cy="392" rx="10" ry="8" fill="currentColor" />
    </svg>
  );
}

function RookWatermark() {
  return (
    <svg
      className="bg-deco bg-deco-rook"
      viewBox="0 0 80 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* battlements */}
      <rect x="4"  y="0"  width="16" height="20" rx="2" fill="currentColor" />
      <rect x="32" y="0"  width="16" height="20" rx="2" fill="currentColor" />
      <rect x="60" y="0"  width="16" height="20" rx="2" fill="currentColor" />
      {/* top body connecting battlements */}
      <rect x="4" y="14" width="72" height="12" fill="currentColor" />
      {/* main body */}
      <rect x="10" y="26" width="60" height="46" rx="1" fill="currentColor" />
      {/* window slit */}
      <rect x="34" y="34" width="12" height="22" rx="2" fill="currentColor" opacity="0.35" />
      {/* base */}
      <rect x="2" y="72" width="76" height="12" rx="2" fill="currentColor" />
      <rect x="6" y="84" width="68" height="10" rx="3" fill="currentColor" opacity="0.7" />
      <rect x="0" y="94" width="80" height="6"  rx="2" fill="currentColor" />
    </svg>
  );
}

export default function PlayPairingGrid({ mode, seekingMode = null, onSelect }) {
  const cells = getPlayPairingCells(mode);
  const isRoyale = mode === "royale";
  const wrapRef = useRef(null);
  useSyncOffset(wrapRef, isRoyale);

  return (
    <div ref={wrapRef} className={`play-pairing-grid-wrap${isRoyale ? " royale-mode" : ""}`}>
      {/* decorative background pieces */}
      <SwordLeft />
      <SwordRight />
      <RookWatermark />

      <div className="play-pairing-grid" role="group" aria-label={`${mode} time controls`}>
        {cells.map((cell, index) => {
          if (!cell) {
            return (
              <div
                key={index}
                className="play-pairing-cell play-pairing-cell-empty"
                aria-hidden="true"
              />
            );
          }

          const isSeeking = cell.value !== null && seekingMode === cell.value;
          const isDisabled = cell.disabled || !cell.value;

          return (
            <button
              key={index}
              type="button"
              className={`play-pairing-cell${isSeeking ? " seeking" : ""}${
                seekingMode && !isSeeking ? " dimmed" : ""
              }${isDisabled ? " disabled-cell" : ""}`}
              onClick={() => !isDisabled && onSelect?.(cell.value)}
              disabled={isDisabled}
              aria-pressed={isSeeking}
            >
              {isSeeking ? (
                <>
                  <span className="seek-spinner" aria-hidden="true" />
                  <span className="seek-cancel-label">Cancel</span>
                </>
              ) : (
                <>
                  <span className="cell-primary">{cell.primary}</span>
                  {cell.label ? <span className="cell-label">{cell.label}</span> : null}
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
