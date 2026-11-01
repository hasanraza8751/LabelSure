import { useCallback, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileCheck2,
  FileSearch,
  Gavel,
  Image as ImageIcon,
  ImageUp,
  RotateCcw,
  Scale,
  ScanLine,
  ScanText,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { CameraCapture } from "@/components/camera-capture"
import { Disclaimer } from "@/components/disclaimer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { api, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

const MAX_SURFACES = 6

type Surface = { file: File; preview: string }

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Capture",
    desc: "Photograph package surfaces",
    icon: Camera,
  },
  {
    num: "02",
    title: "Understand",
    desc: "OCR + field extraction",
    icon: ScanText,
  },
  {
    num: "03",
    title: "Check",
    desc: "Applicable regulatory rules",
    icon: Scale,
  },
  {
    num: "04",
    title: "Verify",
    desc: "Evidence-backed inspector review",
    icon: ShieldCheck,
  },
]

const PIPELINE_STAGES = [
  { num: "01", label: "Image", icon: ImageIcon },
  { num: "02", label: "Quality", icon: CheckCircle2 },
  { num: "03", label: "OCR", icon: ScanLine },
  { num: "04", label: "Extraction", icon: FileSearch },
  { num: "05", label: "Rules", icon: Gavel },
  { num: "06", label: "Result", icon: FileCheck2 },
]

export function InspectPage() {
  const navigate = useNavigate()
  const [surfaces, setSurfaces] = useState<Surface[]>([])
  const [productName, setProductName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const images = Array.from(incoming).filter((f) => f.type.startsWith("image/"))
    if (images.length === 0) {
      toast.error("Only image files can be inspected")
      return
    }
    setSurfaces((current) => {
      const room = MAX_SURFACES - current.length
      if (room <= 0) {
        toast.error(`At most ${MAX_SURFACES} surfaces per package`)
        return current
      }
      if (images.length > room) {
        toast.warning(`Only the first ${room} image(s) were added`)
      }
      return [
        ...current,
        ...images.slice(0, room).map((file) => ({
          file,
          preview: URL.createObjectURL(file),
        })),
      ]
    })
  }, [])

  function removeSurface(index: number) {
    setSurfaces((current) => {
      URL.revokeObjectURL(current[index].preview)
      return current.filter((_, i) => i !== index)
    })
  }

  function reset() {
    surfaces.forEach((s) => URL.revokeObjectURL(s.preview))
    setSurfaces([])
    setError(null)
    setProductName("")
  }

  async function run() {
    if (surfaces.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const inspection = await api.inspect(
        surfaces.map((s) => s.file),
        productName,
      )
      toast.success(`Inspection ${inspection.inspection_id} complete`)
      surfaces.forEach((s) => URL.revokeObjectURL(s.preview))
      navigate(`/inspections/${inspection.inspection_id}`, {
        state: { inspection },
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Sign in to run an inspection."
            : err.message
          : "Could not reach the compliance API. Is the backend running?"
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-10 pb-16">
      {/* ------------------------------------------------ 1. Institutional Hero Section */}
      <section className="relative border-b border-border/60 bg-linear-to-b from-muted/50 via-card to-background pt-10 pb-12">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/8 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary"
            >
              <Sparkles className="size-3.5" />
              AI-Assisted Compliance Screening
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              Statutory Decision Support · LM(PC)R 2011
            </span>
          </div>

          <div className="flex flex-col gap-3 max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl text-balance">
              Inspect packaged commodities with evidence-backed AI assistance.
            </h1>
            <p className="text-base text-muted-foreground leading-relaxed sm:text-lg">
              Capture or upload package surface photographs. LabelSure assists
              authorised officers by extracting mandatory declarations and screening them
              against the Legal Metrology (Packaged Commodities) Rules, 2011 —
              pairing every finding with confidence scores and verbatim citations.
            </p>
          </div>

          {/* ------------------------------------------- 2. How it works (Institutional Flow) */}
          <div className="pt-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              How the screening works
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {WORKFLOW_STEPS.map((step) => {
                const Icon = step.icon
                return (
                  <div
                    key={step.num}
                    className="flex items-start gap-3.5 rounded-lg border border-border/70 bg-card p-3.5 shadow-2xs transition-colors hover:border-primary/30"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                      <Icon className="size-4.5" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] font-bold text-primary">
                          {step.num}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {step.title}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground leading-snug">
                        {step.desc}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ 3. Inspection Workspace */}
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 sm:px-6">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              New Inspection
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure package metadata and submit up to {MAX_SURFACES} surface photographs.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
            {surfaces.length} / {MAX_SURFACES} surfaces staged
          </Badge>
        </div>

        {/* PACKAGE INFORMATION */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Package Information</CardTitle>
            <CardDescription className="text-xs">
              Identifier used to label the report. The rule engine independently resolves brand and product names.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="product-name" className="text-sm font-medium">
                  Product name (optional)
                </FieldLabel>
                <Input
                  id="product-name"
                  placeholder="e.g. Crispy Potato Chips 100 g or Brand Sample Batch #4"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="bg-card max-w-xl text-sm"
                  disabled={busy}
                />
                <FieldDescription className="text-xs text-muted-foreground">
                  Leaves an explicit label on exported PDF reports and the supervisor queue.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* PACKAGE SURFACES */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Package Surfaces</CardTitle>
            <CardDescription className="text-xs">
              Front, back, sides, top, bottom — or a single flat label image.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldGroup>
              <Field>
                {/* Upload Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (!busy) setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    if (!busy) addFiles(e.dataTransfer.files)
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-3.5 rounded-xl border-2 border-dashed p-8 text-center transition-all sm:p-10",
                    dragging
                      ? "border-primary bg-primary/5 scale-[0.99]"
                      : "border-border/80 bg-muted/20 hover:bg-muted/40 hover:border-border",
                    busy && "pointer-events-none opacity-60",
                  )}
                >
                  <div className="flex size-12 items-center justify-center rounded-full bg-card shadow-xs text-primary border">
                    <ImageUp className="size-6" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-md">
                    <p className="text-sm font-semibold text-foreground">
                      Drop photographs here
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Supported: JPEG, PNG, WebP, BMP or TIFF · Up to 20 MB each · Maximum {MAX_SURFACES} surfaces
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => inputRef.current?.click()}
                      disabled={busy || surfaces.length >= MAX_SURFACES}
                      className="gap-2 bg-card font-medium"
                    >
                      <ImageIcon className="size-4 text-muted-foreground" />
                      Choose files
                    </Button>
                    <CameraCapture
                      onCapture={(file) => addFiles([file])}
                      disabled={busy || surfaces.length >= MAX_SURFACES}
                    />
                  </div>

                  <input
                    id="surface-input"
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files)
                      e.target.value = ""
                    }}
                  />
                </div>
              </Field>
            </FieldGroup>

            {/* Uploaded Image Cards */}
            {surfaces.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Staged Surfaces ({surfaces.length})
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Click the trash icon to remove a photograph
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {surfaces.map((surface, index) => (
                    <div
                      key={surface.preview}
                      className="group relative flex flex-col overflow-hidden rounded-lg border border-border/80 bg-card shadow-2xs transition-shadow hover:shadow-xs"
                    >
                      {/* Top surface index badge */}
                      <div className="absolute top-2 left-2 z-10 rounded bg-foreground/80 px-2 py-0.5 text-[10px] font-bold text-background backdrop-blur-xs">
                        Surface 0{index + 1}
                      </div>

                      {/* Remove button */}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        aria-label={`Remove surface ${index + 1}`}
                        disabled={busy}
                        className="absolute top-2 right-2 z-10 size-7 opacity-90 transition-transform hover:scale-105"
                        onClick={() => removeSurface(index)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>

                      {/* Image Preview */}
                      <div className="relative aspect-4/3 w-full bg-muted/40 overflow-hidden">
                        <img
                          src={surface.preview}
                          alt={`Package Surface ${index + 1}`}
                          className="size-full object-cover transition-transform group-hover:scale-102"
                        />
                      </div>

                      {/* Card Footer with Filename and Status */}
                      <div className="flex flex-col gap-0.5 p-2.5 bg-card border-t border-border/60">
                        <span className="truncate text-xs font-medium text-foreground" title={surface.file.name}>
                          {surface.file.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                          <CheckCircle2 className="size-3 shrink-0" />
                          <span>Ready for analysis</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <TriangleAlert className="size-4" />
                <AlertTitle>Inspection could not be completed</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={run}
                  disabled={busy || surfaces.length === 0}
                  size="lg"
                  className="gap-2 bg-primary text-primary-foreground font-semibold px-6 shadow-sm hover:opacity-95"
                >
                  {busy ? "Processing Screening…" : "RUN INSPECTION →"}
                  {!busy && <ArrowRight className="size-4" />}
                </Button>

                <Button
                  variant="ghost"
                  onClick={reset}
                  disabled={busy || (surfaces.length === 0 && !productName)}
                  className="gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3.5" />
                  Clear
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                Evaluates 31 Legal Metrology rules deterministically
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ------------------------------------------------ 4. Live Inspection Progress */}
        {busy && (
          <Card className="border-primary/40 bg-card shadow-sm animate-in fade-in">
            <CardHeader className="pb-3 border-b border-border/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full bg-primary animate-pulse" />
                  <CardTitle className="text-sm font-semibold">
                    Inspection In Progress
                  </CardTitle>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  Screening {surfaces.length} surface(s)
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-6 pb-6 flex flex-col gap-6">
              {/* Horizontal Pipeline Stages */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {PIPELINE_STAGES.map((stage) => {
                  const Icon = stage.icon
                  return (
                    <div
                      key={stage.num}
                      className="flex flex-col items-center gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-center"
                    >
                      <div className="flex size-8 items-center justify-center rounded-full bg-card border text-primary shadow-2xs">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {stage.num}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {stage.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-center text-xs text-muted-foreground">
                Extracting textual declarations, testing image clarity thresholds, and verifying rule clauses against the statutory corpus...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Statutory Disclaimer */}
        {!busy && <Disclaimer />}
      </section>
    </div>
  )
}
