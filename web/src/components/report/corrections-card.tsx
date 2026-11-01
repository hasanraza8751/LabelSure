import { useEffect, useState } from "react"
import { PenLine } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import type { FieldCorrection, Inspection } from "@/lib/types"
import { FIELD_LABELS } from "./declarations-card"

export function CorrectionsCard({ inspection }: { inspection: Inspection }) {
  const [saved, setSaved] = useState<FieldCorrection[]>([])
  const [drafts, setDrafts] = useState<Record<string, { value: string; reason: string }>>({})
  const [busy, setBusy] = useState(false)

  const entries = Object.entries(inspection.extracted_fields).filter(
    ([, field]) => field.value !== null && field.value !== "",
  )

  useEffect(() => {
    api
      .getFieldCorrections(inspection.inspection_id)
      .then((response) => setSaved(response.corrections))
      .catch(() => setSaved([]))
  }, [inspection.inspection_id])

  const byField = Object.fromEntries(saved.map((c) => [c.field_name, c]))

  async function save() {
    const corrections = Object.entries(drafts)
      .filter(([, d]) => d.value.trim() !== "")
      .map(([fieldName, d]) => ({
        field_name: fieldName,
        original_value: inspection.extracted_fields[fieldName]?.value ?? null,
        corrected_value: d.value.trim(),
        reason: d.reason.trim() || undefined,
      }))
    if (corrections.length === 0) return
    setBusy(true)
    try {
      await api.saveFieldCorrections(inspection.inspection_id, { corrections })
      const response = await api.getFieldCorrections(inspection.inspection_id)
      setSaved(response.corrections)
      setDrafts({})
    } catch (error) {
      console.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenLine className="size-5" />
          Correct a reading you can disprove
        </CardTitle>
        <CardDescription>
          If the text reader got a value wrong, write what the package actually
          says. The original reading stays visible below it - the AI result is
          never overwritten.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">No values to correct.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">Declaration</TableHead>
                  <TableHead>AI reading</TableHead>
                  <TableHead className="w-40">Corrected value</TableHead>
                  <TableHead className="w-48">Why</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(([name, field]) => {
                  const correction = byField[name]
                  const draft = draftDraft(drafts[name])
                  return (
                    <TableRow key={name}>
                      <TableCell className="font-medium">
                        {FIELD_LABELS[name] ?? name}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{String(field.value)}</span>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          placeholder={correction ? "Saved: " + correction.corrected_value : "Corrected value"}
                          value={draft.value}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [name]: { ...draft, value: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8"
                          placeholder="Reason (optional)"
                          value={draft.reason}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [name]: { ...draft, reason: e.target.value },
                            }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <span className="text-muted-foreground text-xs">
          {saved.length > 0
            ? `${saved.length} correction(s) recorded`
            : "No corrections recorded"}
        </span>
        <Button onClick={save} disabled={busy || Object.keys(drafts).length === 0}>
          {busy ? "Saving…" : "Save corrections"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function draftDraft(draft?: { value: string; reason: string }) {
  return draft ?? { value: "", reason: "" }
}
