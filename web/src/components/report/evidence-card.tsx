import { useState } from "react"
import {
  BookOpen,
  CheckCircle2,
  FileCheck,
  FileText,
  HelpCircle,
  ImageOff,
  Layers,
  MapPin,
  Scale,
  ScanText,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { ExtractedField, Inspection, RuleResult } from "@/lib/types"

export function EvidenceCard({ inspection }: { inspection: Inspection }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null)
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({})

  const hasImages = inspection.annotated_images.length > 0
  const hasCitations = inspection.regulation_citations.length > 0
  const fields = Object.entries(inspection.extracted_fields || {})

  // Set default selected field if none chosen
  const activeFieldKey = selectedFieldKey || (fields.length > 0 ? fields[0][0] : null)
  const activeField: ExtractedField | null = activeFieldKey
    ? inspection.extracted_fields[activeFieldKey]
    : null

  // Find associated rule results for this field if any
  const relatedRules: RuleResult[] = activeFieldKey
    ? inspection.rule_results.filter(
        (r) =>
          r.fields?.includes(activeFieldKey) ||
          r.rule_id?.toLowerCase().includes(activeFieldKey.toLowerCase()) ||
          r.requirement.toLowerCase().includes(activeFieldKey.toLowerCase()),
      )
    : []

  if (!hasImages && !hasCitations && fields.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageOff />
          </EmptyMedia>
          <EmptyTitle>No visual evidence recorded</EmptyTitle>
          <EmptyDescription>
            No declaration could be located on a surface precisely enough to highlight.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ------------------------------------------- Split Evidence Layout */}
      <Card className="overflow-hidden border-border/80 shadow-xs">
        <CardHeader className="bg-muted/20 border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <FileCheck className="size-5 text-primary" />
                Statutory Evidence & Visual Verification
              </CardTitle>
              <CardDescription className="text-xs">
                Examine located declarations on the physical package surfaces alongside corresponding regulatory clauses.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs bg-card font-medium">
              {inspection.annotated_images.length} Annotated Surface(s) · {fields.length} Declarations
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x border-border/70">
            {/* ----------------- LEFT: Package Image & Surface Navigation (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4 p-5 bg-muted/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  Package Surface Imagery
                </span>

                {/* Multi-surface switcher if available */}
                {inspection.annotated_images.length > 1 && (
                  <div className="flex items-center gap-1">
                    {inspection.annotated_images.map((img, idx) => (
                      <Button
                        key={img.path || idx}
                        type="button"
                        variant={selectedImageIndex === idx ? "default" : "outline"}
                        size="xs"
                        onClick={() => setSelectedImageIndex(idx)}
                        className="text-xs h-7 px-2.5"
                      >
                        Surface 0{idx + 1}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Main Annotated Image Viewer */}
              <div className="relative rounded-lg border border-border/80 bg-black/5 overflow-hidden flex items-center justify-center min-h-[340px] max-h-[520px]">
                {hasImages && !brokenImages[selectedImageIndex] ? (
                  <img
                    src={api.annotatedUrl(inspection.inspection_id, selectedImageIndex)}
                    alt={`Annotated inspection surface ${selectedImageIndex + 1}`}
                    className="size-full object-contain"
                    onError={() =>
                      setBrokenImages((prev) => ({ ...prev, [selectedImageIndex]: true }))
                    }
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
                    <ImageOff className="size-8" />
                    <p className="text-xs font-medium">
                      Annotated overlay not available for this surface index.
                    </p>
                  </div>
                )}

                <div className="absolute bottom-2 left-2 rounded bg-foreground/80 px-2 py-0.5 text-[11px] font-medium text-background backdrop-blur-xs">
                  {inspection.annotated_images[selectedImageIndex]?.name || `Surface ${selectedImageIndex + 1}`}
                </div>
              </div>

              {/* Declaration Selector Chips */}
              {fields.length > 0 && (
                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Select Declaration to Inspect
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {fields.map(([key, f]) => {
                      const isSelected = activeFieldKey === key
                      const hasVal = Boolean(f.value)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedFieldKey(key)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                            isSelected
                              ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                              : hasVal
                                ? "bg-card text-foreground border-border hover:bg-muted"
                                : "bg-muted/40 text-muted-foreground border-dashed hover:bg-muted",
                          )}
                        >
                          <span className="capitalize">{key.replace(/_/g, " ")}</span>
                          {hasVal ? (
                            <span className="text-[10px] opacity-75">✓</span>
                          ) : (
                            <span className="text-[10px] opacity-60">✗</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ----------------- RIGHT: Evidence Inspector Card (5 cols) */}
            <div className="lg:col-span-5 flex flex-col p-5 bg-card gap-5 justify-between">
              {activeField ? (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Declaration Evidence
                      </span>
                      <h4 className="text-lg font-bold text-foreground capitalize">
                        {activeFieldKey?.replace(/_/g, " ")}
                      </h4>
                    </div>
                    {activeField.value ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-xs">
                        <CheckCircle2 className="size-3 mr-1" />
                        Detected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-xs">
                        Missing / Unresolved
                      </Badge>
                    )}
                  </div>

                  {/* 1. WHAT WAS FOUND */}
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/20 p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <ScanText className="size-3.5 text-primary" />
                      What Was Found
                    </span>
                    <div className="text-base font-bold text-foreground break-words">
                      {activeField.value || "— (Declaration not detected on any surface)"}
                    </div>
                    {activeField.ocr_text && (
                      <div className="mt-1 text-xs text-muted-foreground bg-card rounded p-2 border font-mono">
                        Raw OCR: &ldquo;{activeField.ocr_text}&rdquo;
                      </div>
                    )}
                  </div>

                  {/* 2. WHERE IT WAS FOUND */}
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/20 p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary" />
                      Where It Was Found
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Surface Source:</span>
                        <span className="font-semibold text-foreground">
                          {inspection.annotated_images[selectedImageIndex]?.name || "Captured surface"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">OCR Confidence:</span>
                        <span className="font-semibold tabular-nums text-foreground">
                          {activeField.ocr_confidence
                            ? `${Math.round(activeField.ocr_confidence * 100)}%`
                            : "—"}
                        </span>
                      </div>
                      {activeField.bbox && activeField.bbox.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground block text-[10px]">Bounding Coordinates:</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {JSON.stringify(activeField.bbox)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. WHICH RULE APPLIES */}
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/20 p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Scale className="size-3.5 text-primary" />
                      Which Rule Applies
                    </span>
                    {relatedRules.length > 0 ? (
                      relatedRules.map((rule) => (
                        <div key={rule.rule_id} className="flex flex-col gap-1 text-xs pt-1 border-t first:border-0 first:pt-0">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-primary">
                              {rule.rule_id}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {rule.severity}
                            </Badge>
                          </div>
                          <span className="font-medium text-foreground">{rule.requirement}</span>
                          {rule.source?.rule && (
                            <span className="text-[11px] text-muted-foreground">
                              Reference: {rule.source.rule} ({rule.source.document || "LM(PC)R 2011"})
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Governed by the mandatory declaration requirements under Rule 6 of LM(PC)R 2011.
                      </p>
                    )}
                  </div>

                  {/* 4. WHY IT MATTERS */}
                  <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-muted/20 p-3.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <HelpCircle className="size-3.5 text-primary" />
                      Why It Matters
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {activeField.reason ||
                        "Statutory consumer protection mandate ensuring transparent and verifiable product information before retail sale."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <FileText className="size-8 mb-2" />
                  <p className="text-xs">Select a declaration chip above to inspect statutory evidence.</p>
                </div>
              )}

              <div className="border-t pt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Evidence fused via OCR & Regex</span>
                <span className="font-medium text-foreground">Officer Verification Mandatory</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------- Regulation Gazette Citations */}
      {hasCitations && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-primary" />
              <CardTitle className="text-base font-bold">
                Verbatim Legal Metrology Gazette Citations
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Every finding cites verbatim clauses from the Legal Metrology (Packaged Commodities) Rules, 2011.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {inspection.regulation_citations.map((citation, index) => (
                <AccordionItem key={index} value={`citation-${index}`}>
                  <AccordionTrigger className="hover:no-underline py-3">
                    <span className="flex items-center gap-2.5 text-left text-sm font-semibold">
                      <Badge variant="outline" className="font-mono text-xs text-primary bg-primary/5 border-primary/20">
                        {citation.rule ?? `Clause ${index + 1}`}
                      </Badge>
                      <span className="text-foreground">{citation.title ?? citation.document}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="flex flex-col gap-2.5 pt-1 pb-3">
                    <blockquote className="border-l-3 border-primary/40 bg-muted/30 p-3.5 rounded-r text-xs leading-relaxed text-foreground font-serif">
                      &ldquo;{citation.quote}&rdquo;
                    </blockquote>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{citation.document}</span>
                      {citation.page && <span>· Page {citation.page}</span>}
                      {citation.effective_date && <span>· Effective {citation.effective_date}</span>}
                      {citation.verified && (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <ShieldCheck className="size-3.5" /> Verified against official Gazette
                        </span>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
