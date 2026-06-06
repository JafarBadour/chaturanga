import { ROYALE_TIERS, toRoyaleTimeControl } from "./ChessRoyale";

const STANDARD_TIME_CONTROLS = [
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

// 3 columns × 4 rows = 12 cells — same as Lichess
const GRID_SIZE = 12;

function padCells(cells) {
  const padded = [...cells];
  while (padded.length < GRID_SIZE) padded.push(null);
  return padded.slice(0, GRID_SIZE);
}

export function getPlayPairingCells(mode) {
  if (mode === "royale") {
    const royaleCells = ROYALE_TIERS.flatMap((tier) =>
      tier.times.map((seconds) => ({
        value: toRoyaleTimeControl(seconds),
        primary: `${seconds}s`,
        label: tier.label,
      }))
    );
    royaleCells.push({ value: null, primary: "Custom", label: "", disabled: true });
    return padCells(royaleCells);
  }

  const standardCells = [
    ...STANDARD_TIME_CONTROLS.map(({ time, label }) => ({
      value: time,
      primary: time,
      label,
    })),
    { value: null, primary: "Custom", label: "", disabled: true },
  ];

  return padCells(standardCells);
}
