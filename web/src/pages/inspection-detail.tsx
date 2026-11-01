import { useEffect, useState } from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { ArrowLeft, Download, FileText, PlusCircle, ShieldCheck } from "lucide-react"

import { InspectionReport } from "@/components/inspection-report"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api"
import type { Inspection } from "@/lib/types"

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const stateInspection = (location.state as { inspection?: Inspection } | undefined)?.inspection
  const [inspection, setInspection] = useState<Inspection | null>(
    stateInspection && stateInspection.inspection_id === id ? stateInspection : null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    if (stateInspection && stateInspection.inspection_id === id) {
      setInspection(stateInspection)
      return
    }
    setInspection(null)
    setError(null)
    api
      .getInspection(id)
      .then(setInspection)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Could not reach the compliance API",
        ),
      )
  }, [id, stateInspection])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="size-3.5" />
              Back to Dashboard
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold bg-card" asChild>
            <Link to="/inspect">
              <PlusCircle className="size-3.5 text-primary" />
              New Inspection
            </Link>
          </Button>
        </div>

        {id && inspection && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium bg-card" asChild>
              <a href={api.pdfUrl(id)} target="_blank" rel="noreferrer">
                <Download className="size-3.5 text-muted-foreground" />
                Export Official PDF
              </a>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium bg-card" asChild>
              <a href={api.reportUrl(id)} target="_blank" rel="noreferrer">
                <FileText className="size-3.5 text-muted-foreground" />
                Markdown Report
              </a>
            </Button>
          </div>
        )}
      </div>

      <PageHeader
        title={inspection?.product_name || "Statutory Screening Report"}
        description={
          id
            ? `Screening dossier ID: ${id} · Evaluated under the Legal Metrology (Packaged Commodities) Rules, 2011`
            : undefined
        }
        badge={{
          label: "Dossier Active",
          icon: <ShieldCheck className="size-3.5 text-primary" />,
        }}
      />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load this screening</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : inspection ? (
        <InspectionReport inspection={inspection} />
      ) : (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
