import { cn } from "@/lib/utils"

/**
 * Circular SVG gauge for confidence and compliance scores.
 *
 * Shows the percentage in the centre with a coloured arc. Colour changes
 * based on the score: green ≥ 80, amber ≥ 50, red below.
 *
 * A null value renders as "—" with an empty ring, because "not assessed"
 * and "assessed as zero" are different findings.
 */
export function ComplianceGauge({
  value,
  label,
  size = 80,
  strokeWidth = 4,
  className,
}: {
  /** Already on a 0-100 scale. `null` means not assessed. */
  value: number | null
  label?: string
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const assessed = typeof value === "number"
  const clamped = assessed ? Math.max(0, Math.min(100, value)) : 0
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius

  const offset = circumference - (clamped / 100) * circumference

  const arcColor = !assessed
    ? "stroke-muted-foreground/30"
    : clamped >= 80
      ? "stroke-emerald-500"
      : clamped >= 50
        ? "stroke-amber-500"
        : "stroke-red-500"

  const textColor = !assessed
    ? "text-muted-foreground"
    : clamped >= 80
      ? "text-emerald-500"
      : clamped >= 50
        ? "text-amber-500"
        : "text-red-500"

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            className="stroke-muted"
            strokeWidth={strokeWidth}
          />
          {assessed && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              className={cn("transition-all duration-700 ease-out", arcColor)}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-semibold tabular-nums",
              textColor,
              size >= 80 ? "text-lg" : "text-sm",
            )}
          >
            {assessed ? `${Math.round(value)}%` : "—"}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-muted-foreground text-center text-xs">
          {label}
        </span>
      )}
    </div>
  )
}
