/**
 * Circular SVG confidence gauge.
 * value: 0.0 – 1.0
 */
export default function CircleGauge({ value = 0, size = 128 }) {
  const r     = 15.9154943   // radius chosen so circ ≈ 100 at 2πr
  const circ  = 2 * Math.PI * r
  const filled = circ * Math.min(1, Math.max(0, value))
  const pct   = Math.round(value * 100)

  const color =
    value >= 0.80 ? '#16a34a' :
    value >= 0.60 ? '#d97706' : '#dc2626'

  const label =
    value >= 0.80 ? 'High' :
    value >= 0.60 ? 'Medium' : 'Low'

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 36 36"
          width={size}
          height={size}
          className="-rotate-90"
        >
          {/* Background track */}
          <circle
            cx="18" cy="18" r={r}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="3.5"
          />
          {/* Filled arc */}
          <circle
            cx="18" cy="18" r={r}
            fill="none"
            stroke={color}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
            className="gauge-fill"
          />
        </svg>

        {/* Centre label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black leading-none" style={{ color }}>{pct}%</span>
          <span className="text-[11px] text-gray-400 font-semibold mt-0.5">confidence</span>
        </div>
      </div>

      {/* Confidence label chip */}
      <span
        className="text-xs font-bold px-2.5 py-0.5 rounded-full"
        style={{ background: color + '20', color }}
      >
        {label} Confidence
      </span>
    </div>
  )
}
