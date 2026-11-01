import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  XCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Coloured icon for compliance / rule statuses, replacing emoji indicators.
 *
 * Icon and label are always provided, so the status is never carried by
 * colour alone (accessibility requirement from the README).
 */

const STATUS_CONFIG: Record<
  string,
  { icon: typeof CheckCircle2; className: string; label: string }
> = {
  COMPLIANT: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    label: "Compliant",
  },
  PASS: {
    icon: CheckCircle2,
    className: "text-emerald-500",
    label: "Pass",
  },
  NON_COMPLIANT: {
    icon: XCircle,
    className: "text-red-500",
    label: "Non-compliant",
  },
  FAIL: { icon: XCircle, className: "text-red-500", label: "Fail" },
  MANUAL_REVIEW: {
    icon: AlertTriangle,
    className: "text-amber-500",
    label: "Manual review",
  },
  PENDING: {
    icon: Clock,
    className: "text-muted-foreground",
    label: "Pending",
  },
  NOT_APPLICABLE: {
    icon: HelpCircle,
    className: "text-muted-foreground",
    label: "N/A",
  },
  UNVERIFIED: {
    icon: HelpCircle,
    className: "text-sky-500",
    label: "Unverified",
  },
}

const FALLBACK = {
  icon: HelpCircle,
  className: "text-muted-foreground",
  label: "Unknown",
}

export function StatusIndicator({
  status,
  size = "sm",
  showLabel = false,
  className,
}: {
  status: string
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}) {
  const config = STATUS_CONFIG[status] ?? { ...FALLBACK, label: status }
  const Icon = config.icon
  const sizeClass =
    size === "sm" ? "size-4" : size === "md" ? "size-5" : "size-6"

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className={cn(sizeClass, config.className)} />
      {showLabel && (
        <span className={cn("text-sm", config.className)}>{config.label}</span>
      )}
    </span>
  )
}
