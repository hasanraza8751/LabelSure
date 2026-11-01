import { ServerCrash } from "lucide-react"

import { Disclaimer } from "@/components/disclaimer"
import { SignOffCard } from "@/components/sign-off-card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Inspection } from "@/lib/types"

import { VerdictCard } from "@/components/report/verdict-card"
import { FinalVerdictBanner } from "@/components/report/final-verdict-banner"
import { ManualReviewCard } from "@/components/report/manual-review-card"
import { RuleTable } from "@/components/report/rule-results-table"
import { DeclarationsCard } from "@/components/report/declarations-card"
import { EvidenceCard } from "@/components/report/evidence-card"
import { SurfacesCard } from "@/components/report/surfaces-card"
import { CorrectionsCard } from "@/components/report/corrections-card"

export { FIELD_LABELS } from "@/components/report/declarations-card"

/** A system fault reads differently from a bad photograph, so say which it is. */
function isSystemFault(inspection: Inspection) {
  return inspection.images.some((image) => image.ocr_error)
}

export function InspectionReport({ inspection }: { inspection: Inspection }) {
  const violations = inspection.rule_results.filter((r) => r.status === "FAIL")
  const review = inspection.rule_results.filter((r) => r.status === "MANUAL_REVIEW")

  return (
    <div className="flex flex-col gap-6">
      <VerdictCard inspection={inspection} />

      {/* The human's verdict next to the machine's - or the explicit
          statement that no human has signed off yet. */}
      <FinalVerdictBanner inspection={inspection} />

      {/* Targeted manual-review actions: never "inspect the whole package",
          always field + reason + exactly which surface to check. */}
      {(inspection.review_actions?.length ?? 0) > 0 && (
        <ManualReviewCard inspection={inspection} />
      )}

      {isSystemFault(inspection) && (
        <Alert variant="destructive">
          <ServerCrash />
          <AlertTitle>The text reader failed on at least one surface</AlertTitle>
          <AlertDescription>
            This is a fault in the system, not a problem with the photograph.
            Recapturing the package will not help. The affected surfaces are listed
            under Surfaces.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">
            Rules
            <Badge variant="secondary" className="ml-2">{inspection.rule_results.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="fields">Declarations</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="surfaces">Surfaces</TabsTrigger>
          <TabsTrigger value="signoff">Sign-off</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="flex flex-col gap-4 mt-4">
          {violations.length > 0 && (
            <RuleTable
              title="Violations"
              description="Declarations the rule engine found missing or non-conforming."
              rules={violations}
            />
          )}
          {review.length > 0 && (
            <RuleTable
              title="Needs manual review"
              description="Could not be resolved from the captured imagery alone."
              rules={review}
            />
          )}
          <RuleTable
            title="All rules evaluated"
            description="Every clause the engine considered, including those that did not apply."
            rules={inspection.rule_results}
          />
        </TabsContent>

        <TabsContent value="fields" className="mt-4">
          <DeclarationsCard inspection={inspection} />
          <CorrectionsCard inspection={inspection} />
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <EvidenceCard inspection={inspection} />
        </TabsContent>

        <TabsContent value="surfaces" className="mt-4">
          <SurfacesCard inspection={inspection} />
        </TabsContent>

        <TabsContent value="signoff" className="mt-4">
          <SignOffCard inspection={inspection} />
        </TabsContent>
      </Tabs>

      <Disclaimer text={inspection.disclaimer?.text} />
    </div>
  )
}
