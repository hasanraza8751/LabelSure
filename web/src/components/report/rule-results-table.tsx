import { RuleStatusBadge, SeverityBadge } from "@/components/decision-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { RuleResult } from "@/lib/types"

export function RuleTable({
  title,
  description,
  rules,
}: {
  title: string
  description: string
  rules: RuleResult[]
}) {
  return (
    <Card className="border-border/80 shadow-xs overflow-hidden">
      <CardHeader className="pb-3 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
          <span className="text-xs font-semibold text-muted-foreground">
            {rules.length} Rule(s)
          </span>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30 border-b">
              <TableRow>
                <TableHead className="w-36 font-semibold text-xs">Statutory Rule</TableHead>
                <TableHead className="font-semibold text-xs">Requirement & Finding</TableHead>
                <TableHead className="w-36 font-semibold text-xs">Status</TableHead>
                <TableHead className="w-24 font-semibold text-xs text-right">Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y border-b">
              {rules.map((rule, index) => {
                const isFail = rule.status === "FAIL"
                const isReview = rule.status === "MANUAL_REVIEW"
                const isPass = rule.status === "PASS"
                const borderClass = isFail
                  ? "border-l-red-500"
                  : isReview
                    ? "border-l-amber-500"
                    : isPass
                      ? "border-l-emerald-500"
                      : "border-l-transparent"

                return (
                  <TableRow
                    key={`${rule.rule_id}-${index}`}
                    className={`border-l-3 ${borderClass} hover:bg-muted/30 transition-colors`}
                  >
                    <TableCell className="font-mono text-xs font-bold py-3 text-foreground align-top">
                      {rule.source?.rule ?? rule.rule_id ?? "—"}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-xs text-foreground">
                          {rule.requirement || "—"}
                        </span>
                        {rule.reason && (
                          <span className="text-muted-foreground text-xs leading-relaxed">
                            {rule.reason}
                          </span>
                        )}
                        {rule.source?.evidence_text && (
                          <span className="text-muted-foreground border-l-2 border-primary/30 pl-2 text-[11px] font-serif italic mt-0.5">
                            &ldquo;{rule.source.evidence_text}&rdquo;
                            {rule.source.page ? ` — Page ${rule.source.page}` : ""}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 align-top">
                      <RuleStatusBadge status={rule.status} />
                    </TableCell>
                    <TableCell className="py-3 text-right align-top">
                      <SeverityBadge severity={rule.severity} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
