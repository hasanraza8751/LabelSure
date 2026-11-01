import { useEffect, useState } from "react"
import { Check, Gavel, BookOpen } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroupField } from "@/components/toggle-group-field"
import { api, ApiError, token } from "@/lib/api"
import type { Inspection, RuleResult } from "@/lib/types"

import { RuleReviewRow } from "@/components/report/rule-review-row"
import { EmailReportCard } from "@/components/report/email-report-card"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface RecordedDecision {
  action: string
  final_decision: string
  reason: string
  inspector_id: string
  inspector_name?: string | null
  timestamp: string
}

export function SignOffCard({ inspection }: { inspection: Inspection }) {
  const [decision, setDecision] = useState<RecordedDecision | null>(null)
  const [checked, setChecked] = useState(false)
  const [action, setAction] = useState<"ACCEPT" | "OVERRIDE" | "REJECT">("ACCEPT")
  const [reason, setReason] = useState("")
  const [finalDecision, setFinalDecision] = useState("")
  const [inspectorId, setInspectorId] = useState("")
  const [inspectorName, setInspectorName] = useState("")
  const [emailTo, setEmailTo] = useState("")
  const [busy, setBusy] = useState(false)
  const [ruleNotes, setRuleNotes] = useState<Record<string, { status: string; note: string }>>({})
  const [savedNotes, setSavedNotes] = useState(false)

  const authed = Boolean(token.get())

  // Existing sign-off (survives reloads) decides which view to show.
  useEffect(() => {
    setChecked(false)
    api
      .getDecision(inspection.inspection_id)
      .then((response) => {
        const d = (response as { decision: Record<string, unknown> }).decision
        setDecision({
          action: String(d.action ?? ""),
          final_decision: String(d.final_decision ?? ""),
          reason: String(d.reason ?? ""),
          inspector_id: String(d.inspector_id ?? ""),
          inspector_name: (d.inspector_name as string | null) ?? null,
          timestamp: String(d.timestamp ?? ""),
        })
      })
      .catch(() => setDecision(null))
      .finally(() => setChecked(true))
  }, [inspection.inspection_id])

  // Load existing per-rule findings so a return visit shows what was recorded.
  useEffect(() => {
    api
      .getRuleNotes(inspection.inspection_id)
      .then((data) => {
        const map: Record<string, { status: string; note: string }> = {}
        data.notes.forEach((n) => {
          map[n.rule_id] = { status: n.inspector_status, note: n.note }
        })
        setRuleNotes(map)
      })
      .catch(() => {
        /* no notes yet */
      })
  }, [inspection.inspection_id])

  const applicableRules = inspection.rule_results.filter(
    (r) => r.status !== "NOT_APPLICABLE",
  )

  /** Stable non-null key per rule: some results carry no rule_id. */
  function rid(r: RuleResult): string {
    return r.rule_id ?? `idx-${applicableRules.indexOf(r)}`
  }

  const reasonTooShort = reason.trim().length < 10
  const overrideMissing = (action === "OVERRIDE" || action === "REJECT") && !finalDecision
  const idMissing = !authed && !inspectorId.trim()

  function collectNotes() {
    return applicableRules
      .filter((r) => ruleNotes[rid(r)]?.status)
      .map((r) => ({
        rule_id: r.rule_id ?? "",
        rule_reference: r.source?.rule || "",
        ai_status: r.status,
        inspector_status: ruleNotes[rid(r)].status,
        note: ruleNotes[rid(r)].note || "",
      }))
  }

  async function saveRuleNotes() {
    const notes = collectNotes()
    if (notes.length === 0) {
      toast.info("No rule changes to save")
      return
    }
    try {
      await api.saveRuleNotes(inspection.inspection_id, {
        notes,
        inspector_id: authed ? undefined : inspectorId.trim(),
      })
      setSavedNotes(true)
      toast.success("Rule findings saved")
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save rule findings")
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      // Per-rule findings first: they become part of the audit trail of the
      // decision that follows.
      const notes = collectNotes()
      if (notes.length > 0) {
        await api.saveRuleNotes(inspection.inspection_id, {
          notes,
          inspector_id: authed ? undefined : inspectorId.trim(),
        })
      }

      // REJECT is an OVERRIDE to non-compliant with a dedicated wording.
      const bodyAction = action === "REJECT" ? "OVERRIDE" : action
      const bodyFinal = action === "REJECT" ? "NON_COMPLIANT" : finalDecision
      const bodyReason =
        action === "REJECT" ? `Package rejected - ${reason.trim()}` : reason.trim()
      const effectiveFinal =
        bodyFinal || (bodyAction === "ACCEPT" ? inspection.decision || "" : "")

      await api.recordDecision(inspection.inspection_id, {
        action: bodyAction as "ACCEPT" | "OVERRIDE",
        reason: bodyReason,
        final_decision: bodyFinal || undefined,
        inspector_id: authed ? undefined : inspectorId.trim(),
        inspector_name: inspectorName.trim() || undefined,
      })
      setDecision({
        action: bodyAction,
        final_decision: effectiveFinal,
        reason: bodyReason,
        inspector_id: inspectorId.trim(),
        inspector_name: inspectorName.trim() || null,
        timestamp: new Date().toISOString(),
      })
      // One-step delivery: an optional recipient captured with the sign-off
      // mails the report straight away on a compliant verdict.
      if (
        emailTo.trim() &&
        effectiveFinal === "COMPLIANT" &&
        EMAIL_RE.test(emailTo.trim())
      ) {
        try {
          const emailed = await api.emailReport(inspection.inspection_id, {
            to: emailTo.trim(),
          })
          toast.success(emailed.message)
        } catch (emailError) {
          toast.warning(
            emailError instanceof ApiError
              ? emailError.message
              : "Decision recorded, but the report email failed",
          )
        }
      }
      toast.success(
        action === "ACCEPT"
          ? "Finding accepted"
          : action === "REJECT"
            ? "Package rejected and recorded"
            : "Finding overridden and recorded",
      )
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not record the decision",
      )
    } finally {
      setBusy(false)
    }
  }

  if (!checked) return null

  // Already signed off: show the recorded human verdict and, when the
  // inspector passed it, the email panel. No second decision.
  if (decision) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="text-emerald-600" />
              {decision.action === "OVERRIDE"
                ? "Final decision recorded (override)"
                : "Final decision recorded"}
            </CardTitle>
            <CardDescription>
              {decision.inspector_name || decision.inspector_id} · {decision.timestamp}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground font-medium">Final verdict:</span>
              <span className="font-semibold">{decision.final_decision}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Reason: </span>
              {decision.reason}
            </div>
          </CardContent>
        </Card>
        {decision.final_decision === "COMPLIANT" && (
          <EmailReportCard inspection={inspection} />
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Per-rule pass/fail review */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Rule-by-rule findings
          </CardTitle>
          <CardDescription>
            Verify each clause against the physical package. The AI's finding is
            shown beside it as the comparison baseline; toggle Pass/Fail/Review
            to record your own.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {applicableRules.map((rule) => (
            <RuleReviewRow
              key={rid(rule)}
              rule={rule}
              inspectorStatus={ruleNotes[rid(rule)]?.status || ""}
              inspectorNote={ruleNotes[rid(rule)]?.note || ""}
              onStatusChange={(status) =>
                setRuleNotes((prev) => ({
                  ...prev,
                  [rid(rule)]: { ...(prev[rid(rule)] || { note: "" }), status },
                }))
              }
              onNoteChange={(note) =>
                setRuleNotes((prev) => ({
                  ...prev,
                  [rid(rule)]: { ...(prev[rid(rule)] || { status: "" }), note },
                }))
              }
            />
          ))}
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={saveRuleNotes} disabled={savedNotes}>
            {savedNotes ? <Check /> : null}
            Save findings
          </Button>
        </CardFooter>
      </Card>

      {/* Overall sign-off */}
      <Card>
        <form onSubmit={submit}>
          <CardHeader>
            <CardTitle>Inspector sign-off</CardTitle>
            <CardDescription>
              The automated verdict is a recommendation. Nothing is final until an
              authorised inspector accepts, overrides or rejects it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <ToggleGroupField
                  label="Action"
                  value={action}
                  onValueChange={(value) =>
                    setAction(value as "ACCEPT" | "OVERRIDE" | "REJECT")
                  }
                  options={[
                    { value: "ACCEPT", label: "Accept the finding" },
                    { value: "OVERRIDE", label: "Override it" },
                    { value: "REJECT", label: "Reject package" },
                  ]}
                />
              </FieldSet>

              {(action === "OVERRIDE" || action === "REJECT") && (
                <Field data-invalid={overrideMissing || undefined}>
                  <FieldLabel htmlFor="final-decision">
                    {action === "REJECT" ? "Rejection basis" : "Corrected decision"}
                  </FieldLabel>
                  <Select value={finalDecision} onValueChange={setFinalDecision}>
                    <SelectTrigger
                      id="final-decision"
                      aria-invalid={overrideMissing || undefined}
                    >
                      <SelectValue
                        placeholder={
                          action === "REJECT"
                            ? "Why is the package being rejected?"
                            : "Choose the decision that replaces it"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {action === "REJECT" ? (
                          <SelectItem value="NON_COMPLIANT">Non-compliant</SelectItem>
                        ) : (
                          <>
                            <SelectItem value="COMPLIANT">Compliant</SelectItem>
                            <SelectItem value="NON_COMPLIANT">Non-compliant</SelectItem>
                            <SelectItem value="MANUAL_REVIEW">Manual review</SelectItem>
                          </>
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Required for an override. The automated verdict was{" "}
                    {inspection.decision ?? "not assessed"}.
                  </FieldDescription>
                </Field>
              )}

              <Field data-invalid={reasonTooShort || undefined}>
                <FieldLabel htmlFor="reason">Reason</FieldLabel>
                <textarea
                  id="reason"
                  rows={3}
                  aria-invalid={reasonTooShort || undefined}
                  placeholder="What did you verify against the physical package?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive md:text-sm"
                />
                <FieldDescription>
                  Recorded in the audit log against your identity. At least 10 characters.
                </FieldDescription>
              </Field>

              {!authed && (
                <Field data-invalid={idMissing || undefined}>
                  <FieldLabel htmlFor="inspector-id">Inspector identifier</FieldLabel>
                  <Input
                    id="inspector-id"
                    aria-invalid={idMissing || undefined}
                    value={inspectorId}
                    onChange={(e) => setInspectorId(e.target.value)}
                  />
                  <FieldDescription>
                    Required because this deployment has authentication switched off.
                  </FieldDescription>
                </Field>
              )}

              {action === "ACCEPT" && (
                <Field data-invalid={emailTo.trim() && !EMAIL_RE.test(emailTo.trim()) ? true : undefined}>
                  <FieldLabel htmlFor="signoff-email">
                    Email report to (optional)
                  </FieldLabel>
                  <Input
                    id="signoff-email"
                    type="email"
                    placeholder="officer@example.gov.in"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                  />
                  <FieldDescription>
                    Sent with the sign-off attached, right after a compliant
                    verdict is recorded. Non-compliant or review verdicts are
                    never emailed.
                  </FieldDescription>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="inspector-name">Inspector name (optional)</FieldLabel>
                <Input
                  id="inspector-name"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                />
              </Field>
            </FieldGroup>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={busy || reasonTooShort || overrideMissing || idMissing}
              variant={action === "REJECT" ? "destructive" : "default"}
            >
              {busy ? <Spinner data-icon /> : <Gavel />}
              {action === "REJECT"
                ? "Reject package"
                : action === "OVERRIDE"
                  ? "Record override"
                  : "Record decision"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
