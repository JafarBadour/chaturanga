export const GAME_REACTIONS = [
  { id: "thumbs", emoji: "👍", label: "Nice", anim: "react-pop" },
  { id: "laugh", emoji: "😂", label: "LOL", anim: "react-bounce" },
  { id: "fire", emoji: "🔥", label: "Fire", anim: "react-flame" },
  { id: "flex", emoji: "💪", label: "Strong", anim: "react-flex" },
  { id: "eyes", emoji: "👀", label: "Look", anim: "react-wiggle" },
  { id: "target", emoji: "🎯", label: "Aimed", anim: "react-pop" },
  { id: "zap", emoji: "⚡", label: "Zap", anim: "react-zap" },
  { id: "crown", emoji: "👑", label: "King", anim: "react-float" },
  { id: "party", emoji: "🎉", label: "Party", anim: "react-party" },
];

export const REACTION_BY_ID = Object.fromEntries(
  GAME_REACTIONS.map((r) => [r.id, r])
);
