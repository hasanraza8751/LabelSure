import { useEffect, useState } from "react"
import { ShieldCheck, UserCheck } from "lucide-react"

import { FinalDecisionBadge, DecisionBadge } from "@/components/decision-badge"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api"
import type { Inspection } from "@/lib/types"

export function FinalVerdictBanner({ inspection }: { inspection: Inspection }) {
  const [decision, setDecision] = useState<{
    action: string
    final_decision: string
    reason: string
    inspector_id: string
    inspector_name?: string | null
    timestamp: string
  } | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    api
      .getDecision(inspection.inspection_id)
      .then((response) => {
        const d = (response as { decision: Record<string, unknown> }).decision
        setDecision({
          action: String(d.action ?? ""),
          final_decision: String(d.final_decision ?? ""),
          reason: String(d.reason ?? ""),
          inspector_id: String(d.inspector_id ?? ""),
          inspector_name: (d.inspector_name as string | null) ?? null,
          timestamp: String(d.timestamp ?? ""),
        })
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setDecision(null)
        else setDecision(null)
      })
      .finally(() => setChecked(true))
  }, [inspection.inspection_id])

  if (!checked) return null

  return (
    <Card className="border-border/80 shadow-2xs bg-muted/15">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
        {/* Left: AI Assessment */}
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Automated AI Screening:
            </span>
            <DecisionBadge decision={inspection.decision} />
          </div>
        </div>

        {/* Right: Human Verification */}
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded bg-foreground/5 text-foreground">
            <UserCheck className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Officer Statutory Determination:
            </span>
            {decision ? (
              <FinalDecisionBadge decision={decision.final_decision} />
            ) : (
              <Badge variant="outline" className="text-xs font-medium text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800">
                Awaiting Inspector Sign-off
              </Badge>
            )}
          </div>
        </div>

        {decision && (
          <div className="basis-full rounded bg-card p-2.5 border text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {decision.inspector_name || decision.inspector_id}
            </span>{" "}
            ({decision.action === "ACCEPT" ? "Affirmed AI finding" : "Overrode automated screening"}) on{" "}
            {decision.timestamp?.replace("T", " ")}: &ldquo;{decision.reason}&rdquo;
          </div>
        )}
      </CardContent>
    </Card>
  )
}
