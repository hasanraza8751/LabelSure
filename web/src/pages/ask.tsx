import { useEffect, useRef, useState } from "react"
import { BookOpen, CircleSlash, HelpCircle, Scale, Send, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Disclaimer } from "@/components/disclaimer"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api"
import type { ChatTurn, RagAnswer } from "@/lib/types"

const EXAMPLES = [
  "What must be declared as the retail sale price on a pre-packaged commodity?",
  "How should the month and year of manufacture be shown?",
  "What are the minimum font height requirements for declarations?",
  "Which packages are exempt from the packaged commodities rules?",
]

type Turn = { question: string; answer: RagAnswer | null; error?: string }

export function AskPage() {
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns, busy])

  async function ask(text: string) {
    const query = text.trim()
    if (!query || busy) return
    setBusy(true)
    setQuestion("")
    const history: ChatTurn[] = turns.flatMap((turn) =>
      turn.answer
        ? [
            { role: "user" as const, content: turn.question },
            { role: "assistant" as const, content: turn.answer.answer },
          ]
        : [],
    )
    setTurns((current) => [...current, { question: query, answer: null }])
    try {
      const answer = await api.ask({ query, k: 5, history })
      setTurns((current) =>
        current.map((turn, i) => (i === current.length - 1 ? { ...turn, answer } : turn)),
      )
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Could not reach the compliance API"
      setTurns((current) =>
        current.map((turn, i) =>
          i === current.length - 1 ? { ...turn, error: message } : turn,
        ),
      )
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Ask the Rules"
        description="Official Legal Metrology regulatory inquiry tool. Queries are grounded directly in the indexed statutory corpus with citations to Gazette rules. Unsubstantiated claims are rejected by design."
        badge={{
          label: "Gazette Grounded",
          icon: <Scale className="size-3.5 text-primary" />,
        }}
      />

      {turns.length === 0 && (
        <Card className="border-border/80 shadow-xs">
          <CardContent className="py-8">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Sparkles className="size-7 text-primary" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-bold">Inquire about Legal Metrology declarations</EmptyTitle>
                <EmptyDescription className="text-xs max-w-md">
                  Ask about mandatory packaging declarations, exemptions, or verification procedures.
                </EmptyDescription>
              </EmptyHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 max-w-2xl w-full">
                {EXAMPLES.map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    className="h-auto p-3 text-left text-xs font-medium whitespace-normal bg-card hover:bg-muted/60 border-border/80 justify-start"
                    onClick={() => ask(example)}
                  >
                    <HelpCircle className="size-3.5 text-primary shrink-0 mr-1.5" />
                    <span>{example}</span>
                  </Button>
                ))}
              </div>
            </Empty>
          </CardContent>
        </Card>
      )}

      {/* Conversation Turns */}
      <div className="flex flex-col gap-6">
        {turns.map((turn, index) => (
          <div key={index} className="flex flex-col gap-3">
            {/* User Question */}
            <div className="ml-auto max-w-[85%] rounded-xl bg-foreground text-background px-4 py-3 text-sm font-medium shadow-2xs">
              {turn.question}
            </div>

            {/* Error or Response */}
            {turn.error ? (
              <Alert variant="destructive">
                <AlertTitle>Inquiry could not be completed</AlertTitle>
                <AlertDescription className="text-xs">{turn.error}</AlertDescription>
              </Alert>
            ) : turn.answer ? (
              <AnswerCard answer={turn.answer} />
            ) : (
              <Card className="border-border/80 shadow-xs">
                <CardContent className="text-muted-foreground flex items-center gap-3 py-6 text-xs font-medium">
                  <Spinner />
                  Searching the official Legal Metrology regulation corpus…
                </CardContent>
              </Card>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input Box */}
      <div className="bg-background/95 sticky bottom-4 z-20 backdrop-blur-md pt-2">
        <InputGroup className="bg-card shadow-sm border-border/80 rounded-xl overflow-hidden">
          <InputGroupTextarea
            placeholder="Ask about a declaration rule, minimum font height, exemption clause..."
            value={question}
            rows={2}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                ask(question)
              }
            }}
            className="text-sm p-3 placeholder:text-muted-foreground/70"
          />
          <InputGroupAddon align="block-end" className="bg-muted/20 border-t p-2">
            <span className="text-muted-foreground text-[11px]">
              Press Enter to send inquiry
            </span>
            <InputGroupButton
              className="ml-auto bg-primary text-primary-foreground font-semibold px-4 text-xs gap-1.5"
              disabled={busy || !question.trim()}
              onClick={() => ask(question)}
            >
              {busy ? <Spinner data-icon /> : <Send className="size-3.5" />}
              Inquire
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>

      <Disclaimer />
    </div>
  )
}

function AnswerCard({ answer }: { answer: RagAnswer }) {
  if (answer.intent !== "regulation") {
    return (
      <Card className="border-border/80 shadow-xs">
        <CardContent className="flex gap-3.5 p-5 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
          <ShieldCheck className="text-primary mt-0.5 size-5 shrink-0" />
          <span>{answer.answer}</span>
        </CardContent>
      </Card>
    )
  }

  if (!answer.grounded) {
    return (
      <Card className="border-amber-500/40 bg-amber-500/5 shadow-xs">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-sm font-bold">
            <CircleSlash className="size-4.5 text-amber-600" />
            Unsubstantiated In Corpus
          </CardTitle>
          <CardDescription className="text-xs text-amber-900/80 dark:text-amber-300/80">
            {answer.answer}
          </CardDescription>
        </CardHeader>
        {answer.sources.length > 0 && (
          <CardContent className="pt-2">
            <p className="text-muted-foreground mb-2 text-xs font-semibold">
              Closest retrieved statutory clauses for officer review:
            </p>
            <SourceList sources={answer.sources} />
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3 border-b bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-emerald-600" />
            <CardTitle className="text-sm font-bold text-foreground">
              Statutory Finding
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-xs font-semibold">
              {Math.round(answer.confidence * 100)}% Retrieval Confidence
            </Badge>
            <Badge variant="outline" className="text-xs">
              {answer.generator === "groq" ? "Synthesized with Citations" : "Verbatim Extract"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col gap-5">
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground font-sans">
          {answer.answer}
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="size-3.5 text-primary" />
            Supporting Legal Gazette Clauses ({answer.sources.length})
          </h3>
          <SourceList sources={answer.sources} />
        </div>
      </CardContent>
    </Card>
  )
}

function SourceList({ sources }: { sources: RagAnswer["sources"] }) {
  return (
    <Accordion type="multiple" className="w-full">
      {sources.map((source) => (
        <AccordionItem key={source.chunk_id} value={source.chunk_id} className="border-border/60">
          <AccordionTrigger className="py-2.5 hover:no-underline">
            <span className="flex flex-wrap items-center gap-2 text-left text-xs font-semibold">
              <Badge variant="outline" className="font-mono text-[11px] text-primary bg-primary/5">
                {source.metadata.rule}
              </Badge>
              <span className="text-foreground">{source.metadata.title}</span>
              <span className="text-muted-foreground tabular-nums text-[11px] ml-auto">
                Score: {source.score.toFixed(2)}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-2.5 pt-1 pb-3">
            <blockquote className="border-l-3 border-primary/40 bg-muted/30 p-3 rounded-r text-xs leading-relaxed text-foreground font-serif">
              &ldquo;{source.content}&rdquo;
            </blockquote>
            <p className="text-muted-foreground text-[11px]">
              {source.metadata.document}
              {source.metadata.page ? ` · Page ${source.metadata.page}` : ""}
              {source.metadata.verified ? " · Verified Gazette Reference" : ""}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
