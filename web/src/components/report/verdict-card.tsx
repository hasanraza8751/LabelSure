import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  HelpCircle,
  Layers,
  Scale,
  XCircle,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ComplianceGauge } from "@/components/compliance-gauge"
import type { Decision, Inspection } from "@/lib/types"

const DECISION_CONFIG: Record<
  Decision,
  {
    title: string
    subtitle: string
    badgeBg: string
    borderClass: string
    textClass: string
    Icon: typeof CheckCircle2
  }
> = {
  COMPLIANT: {
    title: "COMPLIANT",
    subtitle: "All evaluated mandatory declarations conform with LM(PC)R 2011",
    badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    borderClass: "border-l-4 border-l-emerald-500",
    textClass: "text-emerald-700 dark:text-emerald-400",
    Icon: CheckCircle2,
  },
  MANUAL_REVIEW: {
    title: "MANUAL REVIEW REQUIRED",
    subtitle: "Potential ambiguity or low OCR confidence requires human officer review",
    badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    borderClass: "border-l-4 border-l-amber-500",
    textClass: "text-amber-700 dark:text-amber-400",
    Icon: AlertTriangle,
  },
  NON_COMPLIANT: {
    title: "NON-COMPLIANT",
    subtitle: "One or more mandatory statutory declarations are absent or non-conforming",
    badgeBg: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
    borderClass: "border-l-4 border-l-red-500",
    textClass: "text-red-700 dark:text-red-400",
    Icon: XCircle,
  },
}

export function VerdictCard({ inspection }: { inspection: Inspection }) {
  const confidence = inspection.confidence
  const score = inspection.compliance_score
  const decisionKey = inspection.decision as Decision | null

  const config =
    decisionKey && decisionKey in DECISION_CONFIG
      ? DECISION_CONFIG[decisionKey]
      : {
          title: "NOT ASSESSED",
          subtitle: "Automated evaluation could not determine a definitive verdict",
          badgeBg: "bg-muted text-muted-foreground border-border",
          borderClass: "border-l-4 border-l-muted-foreground",
          textClass: "text-muted-foreground",
          Icon: HelpCircle,
        }

  const DecisionIcon = config.Icon
  const totalRules = inspection.rule_results.length
  const passRules = inspection.rule_results.filter((r) => r.status === "PASS").length
  const failRules = inspection.rule_results.filter((r) => r.status === "FAIL").length
  const reviewRules = inspection.rule_results.filter((r) => r.status === "MANUAL_REVIEW").length

  return (
    <Card className={`overflow-hidden shadow-xs border-border/80 ${config.borderClass}`}>
      {/* Top Banner: High Visibility Decision */}
      <div className="flex flex-col gap-4 p-6 bg-linear-to-r from-card to-muted/20 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${config.badgeBg} shadow-2xs`}>
            <DecisionIcon className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`text-xl font-bold tracking-tight sm:text-2xl ${config.textClass}`}>
                {config.title}
              </span>
              {inspection.product_category && (
                <Badge variant="outline" className="text-xs bg-card font-medium">
                  {inspection.product_category.label}
                  {inspection.product_category.confident ? "" : " (uncertain)"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium max-w-xl">
              {config.subtitle}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end text-xs text-muted-foreground">
          <span className="font-mono text-[11px] font-semibold text-foreground">
            {inspection.inspection_id.slice(0, 16)}…
          </span>
          <span>{inspection.timestamp?.replace("T", " ")}</span>
          {inspection.processing_time_sec !== null && (
            <span className="text-[11px]">Screened in {inspection.processing_time_sec}s</span>
          )}
        </div>
      </div>

      <CardHeader className="pt-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            {inspection.product_name || "Unnamed Package Sample"}
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            Standard: Legal Metrology (Packaged Commodities) Rules, 2011
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* Downgrade notification */}
        {inspection.decision_downgraded_from && (
          <Alert className="border-amber-500/30 bg-amber-500/5">
            <CircleAlert className="text-amber-600 size-4" />
            <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm font-semibold">
              Verdict downgraded from {inspection.decision_downgraded_from}
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-400">
              The compliance engine reduced its own verdict because the captured evidence did not meet the confidence thresholds required for a definitive finding.
            </AlertDescription>
          </Alert>
        )}

        {/* Emphasized Metric Grid: Confidence, Compliance Score, Rules Evaluated, Surfaces Analyzed */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Decision Confidence */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Confidence
              </span>
              <span className="text-sm font-bold text-foreground">
                {confidence ? `${Math.round(confidence.overall * 100)}%` : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">
                Fused quality & text score
              </span>
            </div>
            <div className="shrink-0">
              <ComplianceGauge
                value={confidence ? confidence.overall * 100 : null}
                size={58}
                strokeWidth={5}
              />
            </div>
          </div>

          {/* 2. Compliance Score */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Compliance Score
              </span>
              <span className="text-sm font-bold text-foreground">
                {score?.score !== null && score?.score !== undefined ? `${Math.round(score.score)}%` : "—"}
                {score?.grade ? ` (Grade ${score.grade})` : ""}
              </span>
              <span className="text-[11px] text-muted-foreground leading-tight">
                {score?.scored_rules ?? 0} rules scored
              </span>
            </div>
            <div className="shrink-0">
              <ComplianceGauge
                value={score?.score ?? null}
                size={58}
                strokeWidth={5}
              />
            </div>
          </div>

          {/* 3. Rules Evaluated */}
          <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rules Evaluated
              </span>
              <Scale className="size-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {totalRules}
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-emerald-600 font-semibold">{passRules} Pass</span>
              <span>·</span>
              <span className="text-red-600 font-semibold">{failRules} Fail</span>
              <span>·</span>
              <span className="text-amber-600 font-semibold">{reviewRules} Review</span>
            </div>
          </div>

          {/* 4. Surfaces Analyzed */}
          <div className="flex flex-col justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Surfaces Analyzed
              </span>
              <Layers className="size-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground tabular-nums">
              {inspection.coverage.surfaces_usable} / {inspection.coverage.surfaces_total}
            </div>
            <span className="text-[11px] text-muted-foreground">
              {inspection.coverage.surfaces_usable === inspection.coverage.surfaces_total
                ? "All submitted images usable"
                : `${inspection.coverage.surfaces_total - inspection.coverage.surfaces_usable} rejected by quality gate`}
            </span>
          </div>
        </div>

        {/* Confidence Components */}
        {confidence && Object.keys(confidence.components).length > 0 && (
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
              Confidence Breakdown
            </h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
              {Object.entries(confidence.components).map(([name, value]) => (
                <div key={name} className="flex justify-between gap-2 border-b border-border/40 pb-1">
                  <dt className="capitalize text-muted-foreground">{name.replace(/_/g, " ")}</dt>
                  <dd className="font-semibold tabular-nums text-foreground">{Math.round(value * 100)}%</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Category Breakdown */}
        {score && score.categories.length > 0 && (
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">
              Rule Compliance By Statutory Category
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {score.categories.map((category) => (
                <div
                  key={category.bucket}
                  className="flex items-center justify-between rounded border border-border/50 bg-muted/20 p-2.5 text-xs"
                >
                  <span className="font-medium text-foreground">{category.label}</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {category.score === null
                      ? "Not assessable"
                      : `${Math.round(category.score)}% (${category.pass}/${category.rules_scored})`}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{score.basis}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
