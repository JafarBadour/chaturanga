import React from "react";

const STANDARD_POOLS = [
  { id: "blitz", label: "Blitz" },
  { id: "rapid", label: "Rapid" },
  { id: "classical", label: "Classical" },
];

const ROYALE_POOLS = [
  { id: "royale_bullet", label: "Bullet" },
  { id: "royale_blitz", label: "Blitz" },
  { id: "royale_rapid", label: "Rapid" },
];

function poolPoints(pools, ratings, cx, cy, maxR, minRating, maxRating) {
  const n = pools.length;
  return pools.map((pool, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rating = ratings[pool.id]?.rating ?? 1500;
    const norm = (rating - minRating) / (maxRating - minRating);
    const r = maxR * Math.max(0.08, Math.min(1, norm));
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      labelX: cx + (maxR + 22) * Math.cos(angle),
      labelY: cy + (maxR + 22) * Math.sin(angle),
      pool,
      rating,
    };
  });
}

function SpiderChart({ title, pools, ratings, color }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 78;
  const minRating = 800;
  const maxRating = 2200;

  const pts = poolPoints(pools, ratings, cx, cy, maxR, minRating, maxRating);
  const polygon = pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="spider-chart-wrap">
      <h4>{title}</h4>
      <svg viewBox={`0 0 ${size} ${size}`} className="spider-chart" role="img">
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
            key={level}
            points={pools
              .map((_, i) => {
                const angle = (Math.PI * 2 * i) / pools.length - Math.PI / 2;
                const r = maxR * level;
                return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
              })
              .join(" ")}
            fill="none"
            stroke="#403d39"
            strokeWidth="1"
          />
        ))}
        {pts.map((p, i) => {
          const angle = (Math.PI * 2 * i) / pools.length - Math.PI / 2;
          return (
            <line
              key={p.pool.id}
              x1={cx}
              y1={cy}
              x2={cx + maxR * Math.cos(angle)}
              y2={cy + maxR * Math.sin(angle)}
              stroke="#403d39"
              strokeWidth="1"
            />
          );
        })}
        <polygon points={polygon} fill={`${color}33`} stroke={color} strokeWidth="2" />
        {pts.map((p) => (
          <g key={p.pool.id}>
            <circle cx={p.x} cy={p.y} r="4" fill={color} />
            <text
              x={p.labelX}
              y={p.labelY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="spider-label"
            >
              {p.pool.label}
            </text>
            <text
              x={p.labelX}
              y={p.labelY + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              className="spider-rating"
            >
              {p.rating}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function RatingSpiderChart({ ratings }) {
  return (
    <div className="rating-spider-grid">
      <SpiderChart title="Standard" pools={STANDARD_POOLS} ratings={ratings} color="#81b64c" />
      <SpiderChart title="Royale" pools={ROYALE_POOLS} ratings={ratings} color="#d4a843" />
    </div>
  );
}

export { STANDARD_POOLS, ROYALE_POOLS };
