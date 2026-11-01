import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardCheck,
  Clock,
  Eye,
  FileSearch,
  Lock,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"

import { DecisionBadge, FinalDecisionBadge } from "@/components/decision-badge"
import { Disclaimer } from "@/components/disclaimer"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import type {
  DailyTrendPoint,
  InspectionSummary,
  Stats,
  ViolationRow,
} from "@/lib/types"

type QueueFilter = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "MANUAL_REVIEW"

const FILTERS: {
  key: QueueFilter
  label: string
  count: (s: Stats) => number
  icon: typeof Clock
  accent: string
  border: string
  bg: string
}[] = [
  {
    key: "PENDING",
    label: "To Inspect",
    count: (s) => s.by_inspector_status?.PENDING ?? 0,
    icon: Clock,
    accent: "text-amber-600",
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
  },
  {
    key: "COMPLIANT",
    label: "Compliant",
    count: (s) => s.compliant,
    icon: ShieldCheck,
    accent: "text-emerald-600",
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
  },
  {
    key: "NON_COMPLIANT",
    label: "Non-Compliant",
    count: (s) => s.non_compliant,
    icon: ShieldAlert,
    accent: "text-red-600",
    border: "border-l-red-500",
    bg: "bg-red-500/5",
  },
  {
    key: "MANUAL_REVIEW",
    label: "Manual Review",
    count: (s) => s.manual_review,
    icon: AlertTriangle,
    accent: "text-amber-600",
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
  },
]

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const [filter, setFilter] = useState<QueueFilter>("PENDING")
  const [queue, setQueue] = useState<InspectionSummary[] | null>(null)
  const [queueError, setQueueError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.stats(), api.violations(15)])
      .then(([s, v]) => {
        setStats(s)
        setViolations(v.violations)
      })
      .catch((err) =>
        setError({
          status: err instanceof ApiError ? err.status : 0,
          message:
            err instanceof ApiError ? err.message : "Could not reach the compliance API",
        }),
      )
      .finally(() => setLoading(false))
  }, [])

  const loadQueue = useCallback((f: QueueFilter) => {
    setQueue(null)
    setQueueError(null)
    const params =
      f === "PENDING"
        ? { inspector_status: "PENDING" as const }
        : { decision: f }
    api
      .searchInspections({ ...params, limit: 100 })
      .then((response) => setQueue(response.inspections))
      .catch((err) =>
        setQueueError(
          err instanceof ApiError ? err.message : "Could not load the queue",
        ),
      )
  }, [])

  useEffect(() => {
    loadQueue(filter)
  }, [filter, loadQueue])

  const gated = error?.status === 401 || error?.status === 403

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Inspection Dashboard"
        description="Repository screening statistics, inspector queue, and statutory violation analytics across packaged commodities."
        badge={{
          label: "Statutory Oversight",
          icon: <ShieldCheck className="size-3.5 text-primary" />,
        }}
        actions={
          <Button asChild size="sm" className="gap-1.5 font-semibold bg-primary text-primary-foreground shadow-xs">
            <Link to="/inspect">
              New Inspection
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
          <Skeleton className="h-64 w-full lg:col-span-5 rounded-xl" />
        </div>
      ) : error ? (
        <Alert variant={gated ? "default" : "destructive"}>
          {gated ? <Lock className="size-4" /> : null}
          <AlertTitle className="font-semibold">
            {gated ? "Supervisor access required" : "Could not load the dashboard"}
          </AlertTitle>
          <AlertDescription className="text-xs">
            {gated
              ? "Repository statistics are restricted to supervisor and administrator roles. Sign in from the header."
              : error.message}
          </AlertDescription>
        </Alert>
      ) : stats ? (
        <>
          {/* ------------------------------------------------ 1. Status Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "text-left ring-offset-background transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded-xl cursor-pointer",
                  filter === f.key
                    ? "ring-2 ring-primary shadow-xs"
                    : "hover:shadow-xs",
                )}
              >
                <StatCard
                  icon={f.icon}
                  label={f.label}
                  value={f.count(stats)}
                  accent={f.accent}
                  border={f.border}
                  bg={filter === f.key ? f.bg : undefined}
                />
              </button>
            ))}
            <StatCard
              icon={Activity}
              label="Total Screened"
              value={stats.total_inspections}
              accent="text-primary"
              border="border-l-primary"
            />
          </div>

          {/* --------------------------------------------- 2. Inspection Queue Table */}
          <QueueSection
            filter={filter}
            onSelect={setFilter}
            queue={queue}
            queueError={queueError}
            onRetry={() => loadQueue(filter)}
          />

          {/* --------------------------------------------------- 3. Analytics Block */}
          <AnalyticsBlock stats={stats} violations={violations} />
        </>
      ) : null}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  border,
  bg,
}: {
  label: string
  value: number
  icon: typeof Clock
  accent: string
  border: string
  bg?: string
}) {
  return (
    <Card className={cn("border-l-4 shadow-2xs border-border/80", border, bg)}>
      <CardHeader className="p-4.5">
        <CardDescription className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Icon className={cn("size-3.5 shrink-0", accent)} />
          {label}
        </CardDescription>
        <CardTitle className={cn("text-3xl font-bold tabular-nums pt-1", accent)}>
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function QueueSection({
  filter,
  onSelect,
  queue,
  queueError,
  onRetry,
}: {
  filter: QueueFilter
  onSelect: (f: QueueFilter) => void
  queue: InspectionSummary[] | null
  queueError: string | null
  onRetry: () => void
}) {
  const titles: Record<QueueFilter, string> = {
    PENDING: "Pending Sign-off Queue",
    COMPLIANT: "Compliant Screenings",
    NON_COMPLIANT: "Non-Compliant Screenings",
    MANUAL_REVIEW: "Flagged for Manual Verification",
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            {titles[filter]}
          </h2>
          <span className="text-xs text-muted-foreground">
            Screenings recorded in the statutory compliance repository.
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["PENDING", "To Inspect"],
              ["COMPLIANT", "Compliant"],
              ["NON_COMPLIANT", "Non-Compliant"],
              ["MANUAL_REVIEW", "Manual Review"],
            ] as [QueueFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={cn(
                "rounded-md border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                filter === key
                  ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border-border",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {queueError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load the queue</AlertTitle>
          <AlertDescription>
            {queueError}
            <Button variant="outline" size="sm" className="ml-3" onClick={onRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : queue === null ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : queue.length === 0 ? (
        <Card className="border-border/80 shadow-xs">
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardCheck className="size-8 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-semibold">No screenings found</EmptyTitle>
                <EmptyDescription className="text-xs">
                  {filter === "PENDING"
                    ? "All screenings have been signed off. New inspections will appear here automatically."
                    : "No records found matching this status filter."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/80 shadow-xs overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40 border-b">
                  <TableRow>
                    <TableHead className="w-14 font-semibold text-xs">Photo</TableHead>
                    <TableHead className="font-semibold text-xs">Product</TableHead>
                    <TableHead className="w-28 font-semibold text-xs">Surfaces</TableHead>
                    <TableHead className="w-36 font-semibold text-xs">AI Verdict</TableHead>
                    <TableHead className="w-36 font-semibold text-xs">Human Verdict</TableHead>
                    <TableHead className="w-24 font-semibold text-xs">Confidence</TableHead>
                    <TableHead className="w-40 font-semibold text-xs">Date Screened</TableHead>
                    <TableHead className="w-24 font-semibold text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y border-b">
                  {queue.map((entry) => (
                    <QueueRow key={entry.inspection_id} entry={entry} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

function QueueRow({ entry }: { entry: InspectionSummary }) {
  const action =
    (entry.inspector_status ?? "PENDING") === "PENDING"
      ? entry.decision === "MANUAL_REVIEW"
        ? "Review"
        : "Inspect"
      : "View"

  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell className="py-2.5">
        <QueueThumbnail id={entry.inspection_id} name={entry.product_name} />
      </TableCell>
      <TableCell className="py-2.5">
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-foreground">
            {entry.product_name || "Unnamed package sample"}
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {entry.brand || entry.manufacturer || entry.inspection_id.slice(0, 10)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-xs font-medium tabular-nums py-2.5">
        {entry.surfaces_usable ?? "—"}/{entry.surfaces_total ?? "—"} surfaces
      </TableCell>
      <TableCell className="py-2.5">
        <DecisionBadge decision={entry.decision ?? null} />
      </TableCell>
      <TableCell className="py-2.5">
        {entry.final_decision ? (
          <FinalDecisionBadge decision={entry.final_decision} />
        ) : (
          <Badge variant="outline" className="text-muted-foreground text-xs font-normal">
            Awaiting review
          </Badge>
        )}
      </TableCell>
      <TableCell className="tabular-nums text-xs font-semibold py-2.5">
        {typeof entry.confidence === "number"
          ? `${Math.round(entry.confidence * 100)}%`
          : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap py-2.5">
        {entry.timestamp?.replace("T", " ").slice(0, 16) ?? "—"}
      </TableCell>
      <TableCell className="text-right py-2.5">
        <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs font-medium bg-card hover:bg-muted">
          <Link to={`/inspections/${entry.inspection_id}`}>
            {entry.inspector_status === "PENDING" ? (
              entry.decision === "MANUAL_REVIEW" ? (
                <FileSearch className="size-3.5" />
              ) : (
                <ScanSearch className="size-3.5" />
              )
            ) : (
              <Eye className="size-3.5" />
            )}
            {action}
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

function QueueThumbnail({ id, name }: { id: string; name?: string | null }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className="bg-muted flex size-11 items-center justify-center rounded-md border border-border/80">
        <ScanSearch className="text-muted-foreground size-4.5" />
      </div>
    )
  }
  return (
    <img
      src={api.annotatedUrl(id, 0)}
      alt={name ? `Package thumbnail for ${name}` : "Package thumbnail"}
      className="size-11 rounded-md border border-border/80 object-cover shadow-2xs"
      onError={() => setBroken(true)}
      loading="lazy"
    />
  )
}

/* ------------------------------------------------------------------ analytics */

function AnalyticsBlock({ stats, violations }: { stats: Stats; violations: ViolationRow[] }) {
  return (
    <section className="flex flex-col gap-5 pt-2">
      <div className="flex items-center gap-2 border-b pb-2.5">
        <TrendingUp className="size-5 text-primary" />
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          Compliance Analytics & Violations
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Compliance Rate" value={stats.compliance_rate} format="points" icon={ShieldCheck} />
        <MetricCard label="Average Confidence" value={stats.average_confidence} format="fraction" />
        <MetricCard label="Average Score" value={stats.average_compliance_score} format="points" />
        <MetricCard label="Human Reviewed" value={stats.human_reviewed} />
        <MetricCard label="Override Rate" value={stats.override_rate} format="points" />
        <MetricCard label="Total Screenings" value={stats.total_inspections} icon={Activity} />
        <MetricCard label="Compliant" value={stats.compliant} icon={ShieldCheck} />
        <MetricCard label="Non-Compliant" value={stats.non_compliant} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Most Frequent Violations */}
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <ShieldAlert className="size-4.5 text-red-600" />
              Statutory Declaration Violations
            </CardTitle>
            <CardDescription className="text-xs">
              Frequent non-conformance rules identified under LM(PC)R 2011.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {violations.length === 0 ? (
              <p className="text-muted-foreground text-xs py-4 text-center">No violations recorded yet.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border/60">
                {violations.map((row) => (
                  <div key={row.rule_id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-foreground">{row.rule ?? row.rule_id}</span>
                      <span className="text-muted-foreground text-xs truncate">{row.title ?? "—"}</span>
                    </div>
                    <Badge variant="secondary" className="tabular-nums text-xs font-semibold shrink-0">
                      {row.count} incidents
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Screening Volume */}
        {stats.daily_trend?.length > 0 && (
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Activity className="size-4.5 text-primary" />
                Screening Volume Trend
              </CardTitle>
              <CardDescription className="text-xs">
                Daily inspection throughput categorized by automated verdict.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <BarStrip data={stats.daily_trend} />
            </CardContent>
          </Card>
        )}
      </div>

      <Disclaimer text={stats.disclaimer} />
    </section>
  )
}

function MetricCard({
  label,
  value,
  format,
  icon: Icon,
}: {
  label: string
  value: number | null
  format?: "fraction" | "points"
  icon?: typeof Activity
}) {
  const display =
    value === null || value === undefined
      ? "—"
      : format === "fraction"
        ? `${Math.round(value * 100)}%`
        : format === "points"
          ? `${Math.round(value)}%`
          : String(value)

  return (
    <Card className="border-border/80 shadow-2xs">
      <CardHeader className="p-4">
        <CardDescription className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {Icon && <Icon className="size-3.5 text-primary" />}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl font-bold tabular-nums text-foreground pt-0.5">
          {display}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

const PLOT_HEIGHT = 150

const SEGMENTS = [
  { key: "COMPLIANT", label: "Compliant", className: "bg-emerald-600" },
  { key: "NON_COMPLIANT", label: "Non-compliant", className: "bg-red-600" },
  { key: "MANUAL_REVIEW", label: "Manual review", className: "bg-amber-500" },
] as const

function BarStrip({ data }: { data: DailyTrendPoint[] }) {
  if (data.length === 0) return null
  const max = Math.max(...data.map((d) => d.total), 1)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ height: PLOT_HEIGHT + 28 }}>
        {data.map((day) => (
          <div
            key={day.date}
            className="flex min-w-10 flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="text-xs font-semibold tabular-nums text-foreground">{day.total}</span>
            <div
              className="flex w-full max-w-16 flex-col-reverse overflow-hidden rounded-t-sm"
              style={{ height: (day.total / max) * PLOT_HEIGHT }}
              title={`${day.date}: ${day.total} screening(s)`}
            >
              {SEGMENTS.map((segment) => {
                const value = day[segment.key]
                if (!value) return null
                return (
                  <div
                    key={segment.key}
                    className={segment.className}
                    style={{ flexGrow: value }}
                    title={`${segment.label}: ${value}`}
                  />
                )
              })}
            </div>
            <span className="text-muted-foreground text-[10px] whitespace-nowrap font-mono">
              {day.date.slice(5)}
            </span>
          </div>
        ))}
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs pt-1 border-t">
        {SEGMENTS.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5 text-xs font-medium">
            <span className={`size-2.5 rounded-sm ${segment.className}`} />
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  )
}
