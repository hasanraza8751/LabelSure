import { ServerCrash } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Inspection, SurfaceQuality } from "@/lib/types"

export function SurfacesCard({ inspection }: { inspection: Inspection }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Captured surfaces</CardTitle>
        <CardDescription>
          Whether each photograph was usable, and what the text reader made of it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {inspection.images.map((image) => (
          <div key={image.index} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{image.name}</span>
              <Badge variant={image.usable ? "secondary" : "destructive"}>
                {image.usable ? "usable" : "not usable"}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {image.num_lines} line(s) read
                {typeof image.ocr_avg_confidence === "number" &&
                  ` · ${Math.round(image.ocr_avg_confidence * 100)}% average confidence`}
              </span>
            </div>
            {image.ocr_error && (
              <Alert variant="destructive">
                <ServerCrash />
                <AlertTitle>The text reader could not run on this surface</AlertTitle>
                <AlertDescription>{image.ocr_error}</AlertDescription>
              </Alert>
            )}
            {image.quality?.checks && <QualityChecks quality={image.quality} />}
            <Separator />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function QualityChecks({ quality }: { quality: SurfaceQuality }) {
  const checks = Object.entries(quality.checks ?? {})
  if (checks.length === 0) return null
  const ordered = [...checks].sort(
    (a, b) => Number(a[1].pass) - Number(b[1].pass),
  )

  return (
    <dl className="text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
      {ordered.map(([name, check]) => (
        <div key={name} className="flex justify-between gap-2">
          <dt className={cn("capitalize", !check.pass && "text-destructive font-medium")}>
            {name}
          </dt>
          <dd className="tabular-nums">
            {check.value}
            {check.pass ? "" : ` (limit ${check.threshold ?? `${check.min}–${check.max}`})`}
          </dd>
        </div>
      ))}
    </dl>
  )
}
