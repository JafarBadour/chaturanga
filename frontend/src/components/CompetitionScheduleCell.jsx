import React, { useEffect, useState } from "react";
import {
  getScheduleLines,
  isCountdownLine,
  needsScheduleTick,
} from "../utils/competitionSchedule";

export default function CompetitionScheduleCell({ item, tab }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!needsScheduleTick(item, tab)) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [item.id, item.starts_at, item.ends_at, item.format, tab]);

  const lines = getScheduleLines(item, tab, now);

  return (
    <span className="comp-schedule">
      {lines.map((line) => (
        <span
          key={line}
          className={`comp-schedule-line${isCountdownLine(line) ? " comp-schedule-countdown" : ""}`}
        >
          {line}
        </span>
      ))}
    </span>
  );
}
