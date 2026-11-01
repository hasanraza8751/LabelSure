import { useEffect, useState } from "react"
import { Mail, Send } from "lucide-react"
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
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api"
import type { Inspection } from "@/lib/types"

export function EmailReportCard({ inspection }: { inspection: Inspection }) {
  const [to, setTo] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  useEffect(() => {
    api
      .mailStatus()
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false))
  }, [])

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())

  async function send() {
    setBusy(true)
    try {
      const response = await api.emailReport(inspection.inspection_id, {
        to: to.trim(),
        note: note.trim() || undefined,
      })
      setSent(response.message)
      toast.success(response.message)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not send the email")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5" />
          Email the report
        </CardTitle>
        <CardDescription>
          The signed-off PDF report can be sent to a recipient - a supervisor's
          office, the trader, or the file record.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="flex items-center gap-2 text-sm">
            <Send className="text-emerald-600 size-4" />
            {sent}
          </p>
        ) : configured === false ? (
          <p className="text-muted-foreground text-sm">
            Email delivery is not configured on this server (SMTP_HOST /
            SMTP_USER / SMTP_PASSWORD).
          </p>
        ) : (
          <FieldGroup>
            <Field data-invalid={to.trim() && !valid ? true : undefined}>
              <FieldLabel htmlFor="email-to">Recipient</FieldLabel>
              <Input
                id="email-to"
                type="email"
                placeholder="officer@example.gov.in"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <FieldDescription>
                Sends the PDF report with the recorded sign-off attached.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="email-note">Note (optional)</FieldLabel>
              <Input
                id="email-note"
                placeholder="Added to the email body"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </FieldGroup>
        )}
      </CardContent>
      {!sent && (
        <CardFooter>
          <Button onClick={send} disabled={busy || !valid || configured === false}>
            {busy ? <Spinner data-icon /> : <Send />}
            Send report
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
