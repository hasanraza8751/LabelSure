import { CheckCircle2, ImageOff, ScanText, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Inspection } from "@/lib/types"

export const FIELD_LABELS: Record<string, string> = {
  mrp: "Retail Sale Price (MRP)",
  net_quantity: "Net Quantity",
  manufacturer: "Manufacturer / Packer Identity",
  brand: "Brand Name",
  product_name: "Generic / Common Product Name",
  manufacturing_date: "Month & Year of Manufacture",
  packing_date: "Month & Year of Packing",
  expiry_date: "Expiry / Use By Date",
  consumer_care: "Consumer Care Contact Information",
  country_of_origin: "Country of Origin",
  best_before: "Best Before Date",
  batch_number: "Batch / Lot Number",
  importer: "Importer Name & Address",
  packer: "Packer Name & Address",
}

export function DeclarationsCard({ inspection }: { inspection: Inspection }) {
  const entries = Object.entries(inspection.extracted_fields)
  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageOff />
          </EmptyMedia>
          <EmptyTitle>No declarations extracted</EmptyTitle>
          <EmptyDescription>
            Nothing on the captured surfaces could be resolved into a statutory declaration.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3 border-b bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <ScanText className="size-4.5 text-primary" />
              Extracted Statutory Declarations
            </CardTitle>
            <CardDescription className="text-xs">
              Extracted declaration values resolved from packaging OCR lines and regular expression patterns.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {entries.filter(([, f]) => Boolean(f.value)).length} of {entries.length} Detected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30 border-b">
              <TableRow>
                <TableHead className="w-64 font-semibold text-xs">Mandatory Declaration</TableHead>
                <TableHead className="font-semibold text-xs">Detected Value</TableHead>
                <TableHead className="font-semibold text-xs">Source OCR Reading</TableHead>
                <TableHead className="w-36 font-semibold text-xs text-right">Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y border-b">
              {entries.map(([name, field]) => {
                const hasValue = Boolean(field.value)
                return (
                  <TableRow key={name} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-semibold text-xs py-3">
                      <div className="flex items-center gap-2">
                        {hasValue ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="size-3.5 text-muted-foreground/60 shrink-0" />
                        )}
                        <span>{FIELD_LABELS[name] ?? name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {hasValue ? (
                        <span className="font-bold text-sm text-foreground">{field.value}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">Not detected</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs py-3 max-w-xs truncate">
                      {field.ocr_text ? `"${field.ocr_text}"` : "—"}
                    </TableCell>
                    <TableCell className="text-right py-3 tabular-nums">
                      {hasValue ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-bold text-xs text-foreground">
                            {typeof field.extraction_confidence === "number"
                              ? `${Math.round(field.extraction_confidence * 100)}%`
                              : "—"}
                          </span>
                          {field.confidence_level && (
                            <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                              {field.confidence_level}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">0%</span>
                      )}
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
