import { AlertTriangle, Check, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import type { RuleResult } from "@/lib/types"

export const STATUS_OPTIONS = [
  { value: "PASS", label: "Pass", icon: Check },
  { value: "FAIL", label: "Fail", icon: X },
  { value: "MANUAL_REVIEW", label: "Review", icon: AlertTriangle },
]

export const AI_STATUS_ICON: Record<string, string> = {
  PASS: "✅",
  FAIL: "❌",
  MANUAL_REVIEW: "⚠️",
  NOT_APPLICABLE: "—",
}

export function RuleReviewRow({
  rule,
  inspectorStatus,
  inspectorNote,
  onStatusChange,
  onNoteChange,
}: {
  rule: RuleResult
  inspectorStatus: string
  inspectorNote: string
  onStatusChange: (status: string) => void
  onNoteChange: (note: string) => void
}) {
  const aiStatus = rule.status || "NOT_APPLICABLE"
  const changed = inspectorStatus && inspectorStatus !== aiStatus

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-3 ${
        changed ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {rule.source?.rule || rule.rule_id}
            </span>
            <span className="text-muted-foreground text-xs">
              AI: {AI_STATUS_ICON[aiStatus] || aiStatus} {aiStatus}
            </span>
          </div>
          <p className="text-sm">{rule.requirement}</p>
          {rule.reason && <p className="text-muted-foreground text-xs">{rule.reason}</p>}
          {rule.source?.evidence_text && (
            <p className="text-muted-foreground border-l-2 pl-2 text-xs italic">
              “{rule.source.evidence_text}”
              {rule.source.page ? ` — page ${rule.source.page}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = inspectorStatus === opt.value
            const aiActive = aiStatus === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusChange(active ? "" : opt.value)}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                  active
                    ? opt.value === "PASS"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : opt.value === "FAIL"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                    : aiActive
                      ? "bg-muted text-muted-foreground"
                      : "bg-background text-muted-foreground/60 hover:bg-accent"
                }`}
                title={opt.label}
              >
                <Icon className="size-3" />
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      {changed && (
        <Input
          placeholder="Why are you overriding this rule?"
          value={inspectorNote}
          onChange={(e) => onNoteChange(e.target.value)}
          className="h-8 text-xs"
        />
      )}
    </div>
  )
}
