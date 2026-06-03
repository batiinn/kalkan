"use client";

interface Props {
  score: number;
  grade: string;
  animate?: boolean;
}

export function ScoreGauge({ score, grade }: Props) {
  const radius = 86;
  const circ = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const dash = circ * pct;

  const color =
    score >= 85 ? "var(--color-ok)" : score >= 55 ? "var(--color-med)" : score >= 40 ? "var(--color-low)" : "var(--color-crit)";

  return (
    <div className="relative grid place-items-center" style={{ width: 200, height: 200 }}>
      <svg width="200" height="200" viewBox="0 0 200 200" className="-rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--color-border)" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-6xl font-extrabold tracking-tight tabular-nums" style={{ color }}>
            {score}
          </div>
          <div className="mono mt-0.5 text-sm font-semibold tracking-widest" style={{ color }}>
            {grade}
          </div>
        </div>
      </div>
    </div>
  );
}
