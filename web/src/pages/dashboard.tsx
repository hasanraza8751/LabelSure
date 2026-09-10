import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Activity,
  ClipboardCheck,
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

/**
 * The inspector's work dashboard.
 *
 * Ordered by attention, not by interest: the status cards at the top jump the
 * queue to the screenings that need a human decision first; proven/failed
 * packages and the analytics sit below. Data comes from the existing
 * /stats and /inspections/search endpoints - no backend changes.
 */

type QueueFilter = "PENDING" | "COMPLIANT" | "NON_COMPLIANT" | "MANUAL_REVIEW"

const FILTERS: {
  key: QueueFilter
  label: string
  count: (s: Stats) => number
  accent: string
}[] = [
  {
    key: "PENDING",
    label: "To Inspect",
    count: (s) => s.by_inspector_status?.PENDING ?? 0,
    accent: "text-orange-500",
  },
  {
    key: "COMPLIANT",
    label: "Compliant",
    count: (s) => s.compliant,
    accent: "text-emerald-500",
  },
  {
    key: "NON_COMPLIANT",
    label: "Non-Compliant",
    count: (s) => s.non_compliant,
    accent: "text-red-500",
  },
  {
    key: "MANUAL_REVIEW",
    label: "Manual Review",
    count: (s) => s.manual_review,
    accent: "text-amber-500",
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          What needs your attention, what has passed or failed, and why.
        </p>
      </header>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
          <Skeleton className="h-64 w-full lg:col-span-5" />
        </div>
      ) : error ? (
        <Alert variant={gated ? "default" : "destructive"}>
          {gated ? <Lock /> : null}
          <AlertTitle>
            {gated ? "Supervisor access required" : "Could not load the dashboard"}
          </AlertTitle>
          <AlertDescription>
            {gated
              ? "Repository statistics are restricted to supervisor and administrator roles. Sign in from the header."
              : error.message}
          </AlertDescription>
        </Alert>
      ) : stats ? (
        <>
          {/* ------------------------------------------------ 1. status overview */}
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "text-left ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  filter === f.key
                    ? "rounded-xl ring-2 ring-ring"
                    : "rounded-xl hover:shadow-md",
                )}
              >
                <StatCard
                  emoji={
                    f.key === "PENDING"
                      ? "🟠"
                      : f.key === "COMPLIANT"
                        ? "🟢"
                        : f.key === "NON_COMPLIANT"
                          ? "🔴"
                          : "🟡"
                  }
                  label={f.label}
                  value={f.count(stats)}
                  accent={f.accent}
                />
              </button>
            ))}
            <StatCard label="Total inspections" value={stats.total_inspections} />
          </div>

          {/* --------------------------------------------- 2. inspection queue */}
          <QueueSection
            filter={filter}
            onSelect={setFilter}
            queue={queue}
            queueError={queueError}
            onRetry={() => loadQueue(filter)}
          />

          {/* --------------------------------------------------- 5. analytics */}
          <AnalyticsBlock stats={stats} violations={violations} />
        </>
      ) : null}
    </div>
  )
}

/** One clickable status card. Counts are live from /stats, not stale. */
function StatCard({
  label,
  value,
  emoji,
  accent,
}: {
  label: string
  value: number
  emoji?: string
  accent?: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {emoji ? <span aria-hidden>{emoji}</span> : null}
          {label}
        </CardDescription>
        <CardTitle className={cn("text-3xl tabular-nums", accent)}>{value}</CardTitle>
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
    PENDING: "Waiting for an inspector",
    COMPLIANT: "Compliant screenings",
    NON_COMPLIANT: "Non-compliant screenings",
    MANUAL_REVIEW: "Screenings flagged for manual review",
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{titles[filter]}</h2>
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
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
        <Skeleton className="h-64 w-full" />
      ) : queue.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ClipboardCheck />
                </EmptyMedia>
                <EmptyTitle>Nothing here</EmptyTitle>
                <EmptyDescription>
                  {filter === "PENDING"
                    ? "Every screening has been signed off. New inspections appear here as they come in."
                    : "No screenings with this status yet."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Photo</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-32">Surfaces</TableHead>
                    <TableHead className="w-36">AI verdict</TableHead>
                    <TableHead className="w-36">Human verdict</TableHead>
                    <TableHead className="w-24">Confidence</TableHead>
                    <TableHead className="w-40">Screened</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
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
  // PENDING rows get the action verb; signed-off ones are already reviewed.
  const action =
    (entry.inspector_status ?? "PENDING") === "PENDING"
      ? entry.decision === "MANUAL_REVIEW"
        ? "Review"
        : "Inspect"
      : "View"

  return (
    <TableRow>
      <TableCell>
        <QueueThumbnail id={entry.inspection_id} name={entry.product_name} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{entry.product_name || "Unnamed package"}</span>
          <span className="text-muted-foreground font-mono text-xs">
            {entry.brand || entry.manufacturer || entry.inspection_id.slice(0, 8)}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm tabular-nums">
        {entry.surfaces_usable ?? "—"}/{entry.surfaces_total ?? "—"} images
      </TableCell>
      <TableCell>
        <DecisionBadge decision={entry.decision ?? null} />
      </TableCell>
      <TableCell>
        {entry.final_decision ? (
          <FinalDecisionBadge decision={entry.final_decision} />
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Awaiting sign-off
          </Badge>
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {typeof entry.confidence === "number"
          ? `${Math.round(entry.confidence * 100)}%`
          : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
        {entry.timestamp?.replace("T", " ").slice(0, 16) ?? "—"}
      </TableCell>
      <TableCell>
        <Button asChild variant="outline" size="sm">
          <Link to={`/inspections/${entry.inspection_id}`}>
            {entry.inspector_status === "PENDING" ? (
              entry.decision === "MANUAL_REVIEW" ? (
                <FileSearch />
              ) : (
                <ScanSearch />
              )
            ) : (
              <Eye />
            )}
            {action}
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}

/** First annotated surface as the thumbnail; falls back to an icon when the
 *  overlay image was not generated for this screening. */
function QueueThumbnail({ id, name }: { id: string; name?: string | null }) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return (
      <div className="bg-muted flex size-12 items-center justify-center rounded-md border">
        <ScanSearch className="text-muted-foreground size-5" />
      </div>
    )
  }
  return (
    <img
      src={api.annotatedUrl(id, 0)}
      alt={name ? `Package thumbnail for ${name}` : "Package thumbnail"}
      className="size-12 rounded-md border object-cover"
      onError={() => setBroken(true)}
      loading="lazy"
    />
  )
}

/* ------------------------------------------------------------------ analytics */

function AnalyticsBlock({ stats, violations }: { stats: Stats; violations: ViolationRow[] }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <TrendingUp className="size-5" />
        Analytics
      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Compliance rate" value={stats.compliance_rate} format="points" />
        <Metric
          label="Average confidence"
          value={stats.average_confidence}
          format="fraction"
        />
        <Metric
          label="Average compliance score"
          value={stats.average_compliance_score}
          format="points"
        />
        <Metric label="Human reviewed" value={stats.human_reviewed} />
        <Metric label="Override rate" value={stats.override_rate} format="points" />
        <Metric label="Total inspections" value={stats.total_inspections} />
        <Metric label="Compliant" value={stats.compliant} />
        <Metric label="Non-compliant" value={stats.non_compliant} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5" />
            Most frequent violations
          </CardTitle>
          <CardDescription>
            The rules breached most often, with the clause each one cites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {violations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No violations recorded yet.</p>
          ) : (
            <ViolationList violations={violations} />
          )}
        </CardContent>
      </Card>

      {stats.daily_trend?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              Inspections per day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarStrip data={stats.daily_trend} />
          </CardContent>
        </Card>
      )}

      <Disclaimer text={stats.disclaimer} />
    </section>
  )
}

function ViolationList({ violations }: { violations: ViolationRow[] }) {
  return (
    <div className="flex flex-col divide-y">
      {violations.map((row) => (
        <div key={row.rule_id} className="flex items-baseline justify-between gap-3 py-2">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs">{row.rule ?? row.rule_id}</span>
            <span className="text-muted-foreground text-sm">{row.title ?? "—"}</span>
          </div>
          <Badge variant="secondary" className="tabular-nums">
            {row.count}
          </Badge>
        </div>
      ))}
    </div>
  )
}

function Metric({
  label,
  value,
  format,
}: {
  label: string
  value: number | null
  /** "fraction" is 0-1, "points" is already 0-100, omitted is a plain count. */
  format?: "fraction" | "points"
}) {
  // Distinguish "nothing to measure yet" from a measured zero.
  const display =
    value === null || value === undefined
      ? "—"
      : format === "fraction"
        ? `${Math.round(value * 100)}%`
        : format === "points"
          ? `${Math.round(value)}%`
          : String(value)
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-1.5">
          {label.includes("Compliance rate") || label === "Compliant" ? (
            <ShieldCheck className="size-3.5" />
          ) : null}
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{display}</CardTitle>
      </CardHeader>
    </Card>
  )
}

/**
 * Daily screening volume, stacked by outcome.
 *
 * Plain divs rather than a charting dependency: one chart of one series does
 * not justify the weight. Heights are computed in pixels against a fixed plot
 * height, because a percentage height inside an auto-height flex column
 * resolves to zero - which is exactly how this rendered as an empty box
 * before.
 */
const PLOT_HEIGHT = 160

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
            <span className="text-xs font-medium tabular-nums">{day.total}</span>
            <div
              className="flex w-full max-w-16 flex-col-reverse overflow-hidden rounded-sm"
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
            <span className="text-muted-foreground text-[10px] whitespace-nowrap">
              {day.date.slice(5)}
            </span>
          </div>
        ))}
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        {SEGMENTS.map((segment) => (
          <span key={segment.key} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${segment.className}`} />
            {segment.label}
          </span>
        ))}
      </div>
    </div>
  )
}
