const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

export function parseCompTime(iso) {
  if (!iso) return null;
  if (iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso)) {
    return new Date(iso).getTime();
  }
  return new Date(`${iso}Z`).getTime();
}

export function formatCompDate(iso, { withYear = false } = {}) {
  const ms = parseCompTime(iso);
  if (ms == null) return "—";
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCountdown(ms) {
  if (ms <= 0) return "0:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function needsScheduleTick(item, tab, nowMs = Date.now()) {
  if (tab === "upcoming" && item.starts_at) {
    const startMs = parseCompTime(item.starts_at);
    const until = startMs - nowMs;
    return until > 0 && until <= TWENTY_FOUR_H_MS;
  }
  if (tab === "running" && item.format === "fifm" && item.ends_at) {
    const endMs = parseCompTime(item.ends_at);
    const until = endMs - nowMs;
    return until > 0 && until <= TWENTY_FOUR_H_MS;
  }
  return false;
}

export function scheduleColumnLabel(tab) {
  if (tab === "upcoming") return "Starts";
  if (tab === "running") return "Schedule";
  return "Ended";
}

/** Plain-text schedule for list cells (one or two lines joined by newline). */
export function getScheduleLines(item, tab, nowMs = Date.now()) {
  if (tab === "upcoming") {
    if (!item.starts_at) return ["—"];
    const startMs = parseCompTime(item.starts_at);
    const until = startMs - nowMs;
    if (until <= 0) return [formatCompDate(item.starts_at)];
    if (until <= TWENTY_FOUR_H_MS) {
      return [`Starts in ${formatCountdown(until)}`];
    }
    return [formatCompDate(item.starts_at, { withYear: true })];
  }

  if (tab === "running") {
    const started = item.starts_at ? formatCompDate(item.starts_at) : "—";
    if (item.format === "fifm") {
      if (!item.ends_at) return [`Started ${started}`];
      const endMs = parseCompTime(item.ends_at);
      const untilEnd = endMs - nowMs;
      if (untilEnd > 0 && untilEnd <= TWENTY_FOUR_H_MS) {
        return [`Started ${started}`, `Ends in ${formatCountdown(untilEnd)}`];
      }
      return [`Started ${started}`, `Ends ${formatCompDate(item.ends_at)}`];
    }
    return [`Started ${started}`];
  }

  if (item.ends_at) return [formatCompDate(item.ends_at, { withYear: true })];
  if (item.starts_at) return [formatCompDate(item.starts_at, { withYear: true })];
  return ["—"];
}

export function isCountdownLine(line) {
  return line.startsWith("Starts in ") || line.startsWith("Ends in ");
}
