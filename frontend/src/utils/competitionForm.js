export const STANDARD_TIME_CONTROLS = [
  "1+0", "2+1", "3+0", "3+2", "5+0", "5+3", "10+0", "10+5", "15+10", "30+0", "30+20",
];

export const FORMATS = [
  { id: "swiss", label: "Swiss", desc: "Fixed rounds, paired by score" },
  { id: "candidates", label: "Candidates", desc: "Elimination bracket for qualifiers" },
  {
    id: "fifm",
    label: "FIFM",
    desc: "First in, first matched — instant pairing for the event window",
  },
];

export const DURATION_PRESETS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "8 hours", value: 480 },
];

export function defaultStartLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 10);
  d.setSeconds(0, 0);
  return toDatetimeLocal(d.toISOString());
}

export function toDatetimeLocal(iso) {
  if (!iso) return defaultStartLocal();
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function minStartLocal() {
  return toDatetimeLocal(new Date().toISOString());
}

export function emptyFormValues() {
  return {
    name: "",
    gameMode: "standard",
    format: "swiss",
    timeControl: "5+0",
    startsAt: defaultStartLocal(),
    isPublic: true,
    maxParticipants: "",
    minRating: "",
    maxRating: "",
    durationMinutes: "60",
    notes: "",
  };
}

export function formValuesFromCompetition(comp) {
  return {
    name: comp.name || "",
    gameMode: comp.game_mode || "standard",
    format: comp.format || "swiss",
    timeControl: comp.time_control || "5+0",
    startsAt: toDatetimeLocal(comp.starts_at),
    isPublic: comp.is_public !== false,
    maxParticipants: comp.max_participants != null ? String(comp.max_participants) : "",
    minRating: comp.min_rating != null ? String(comp.min_rating) : "",
    maxRating: comp.max_rating != null ? String(comp.max_rating) : "",
    durationMinutes:
      comp.duration_minutes != null ? String(comp.duration_minutes) : "60",
    notes: comp.notes || "",
  };
}

export function buildCompetitionPayload(values) {
  const payload = {
    name: values.name.trim(),
    game_mode: values.gameMode,
    format: values.format,
    time_control: values.timeControl,
    starts_at: new Date(values.startsAt).toISOString(),
    is_public: values.isPublic,
    notes: values.notes.trim() || null,
  };

  if (values.maxParticipants) payload.max_participants = Number(values.maxParticipants);
  if (values.minRating) payload.min_rating = Number(values.minRating);
  if (values.maxRating) payload.max_rating = Number(values.maxRating);
  if (values.format === "fifm") payload.duration_minutes = Number(values.durationMinutes);

  return payload;
}
