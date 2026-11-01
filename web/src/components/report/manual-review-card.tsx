import { CircleAlert, MapPin } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Inspection } from "@/lib/types"

export function ManualReviewCard({ inspection }: { inspection: Inspection }) {
  return (
    <Card className="border-amber-600/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleAlert className="text-amber-600 size-5" />
          Needs manual verification
        </CardTitle>
        <CardDescription>
          Each unresolved declaration, with the exact surface to check. Verified
          (pass) declarations are not listed.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {inspection.review_actions!.map((action, index) => (
          <div key={`${action.rule_id}-${index}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold">⚠ {action.field_label}</span>
              {action.rule_reference && (
                <span className="text-muted-foreground font-mono text-xs">
                  {action.rule_reference}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm">{action.reason}</p>
            <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {action.check_location}
              </span>
              {action.source_image && <span>Image: {action.source_image}</span>}
              <span>Confidence: {Math.round(action.confidence * 100)}%</span>
              {action.current_value != null && (
                <span>
                  Detected: <span className="font-mono">{String(action.current_value)}</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
