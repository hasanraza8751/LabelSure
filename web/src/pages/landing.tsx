import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  FileSearch,
  Gavel,
  Landmark,
  LineChart,
  MessageSquareQuote,
  ScanLine,
  ShieldCheck,
  UserCheck,
} from "lucide-react"

import { Disclaimer, SHORT_DISCLAIMER } from "@/components/disclaimer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import type { CorpusStats } from "@/lib/types"

const PIPELINE = [
  {
    Icon: Camera,
    title: "Capture",
    body: "Photograph up to six surfaces of one package. A quality gate rejects blurred, glared or skewed frames before they can produce a false verdict.",
  },
  {
    Icon: FileSearch,
    title: "Read",
    body: "OCR lifts every text line with its confidence and position, then field extraction resolves MRP, net quantity, dates, manufacturer and consumer care.",
  },
  {
    Icon: Gavel,
    title: "Apply the rules",
    body: "A deterministic engine evaluates 31 declarations from the Legal Metrology (Packaged Commodities) Rules, 2011. No model decides compliance.",
  },
  {
    Icon: UserCheck,
    title: "Hand to a human",
    body: "Every verdict carries its confidence, its evidence and its citation, and waits for an inspector to accept, override or escalate it.",
  },
]

const FEATURES = [
  {
    Icon: ShieldCheck,
    title: "Deterministic verdicts",
    body: "Rules are data, not prompts. The same package and the same photographs always produce the same finding, and every finding names the clause it came from.",
  },
  {
    Icon: MessageSquareQuote,
    title: "Grounded answers",
    body: "Ask the regulation corpus a question in plain English. Answers are built from retrieved clauses and cite them; when retrieval is weak the system refuses instead of guessing.",
  },
  {
    Icon: BookOpenCheck,
    title: "Citations, not paraphrase",
    body: "Each retrieved clause carries its document, rule reference, page number and verbatim quote, so a finding can be checked against the Gazette.",
  },
  {
    Icon: LineChart,
    title: "Supervisor view",
    body: "Compliance rate, common violations, override rate and inspector activity across the whole repository, with the citation behind each violation.",
  },
]

export function LandingPage() {
  const [corpus, setCorpus] = useState<CorpusStats | null>(null)

  useEffect(() => {
    api.corpusStats().then(setCorpus).catch(() => setCorpus(null))
  }, [])

  return (
    <div className="flex flex-col">
      {/* ------------------------------------------------ 1. Hero */}
      <section className="border-b border-border/70 bg-linear-to-b from-muted/40 via-card to-background">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:py-24">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/8 text-primary font-semibold text-xs">
              <ScanLine className="size-3.5" />
              LM(PC)R 2011 · 31 Declarations Evaluated
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-xs font-medium">
              <Landmark className="size-3 text-muted-foreground" />
              Smart India Hackathon 2026
            </Badge>
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
            Screen packaged-commodity labels against the Legal Metrology rules.
          </h1>

          <p className="text-muted-foreground max-w-2xl text-base sm:text-lg leading-relaxed text-pretty">
            Photograph a package. LabelSure reads the declarations, applies the
            packaged-commodities rules clause by clause, and hands an inspector a
            verdict with its evidence, its confidence and the verbatim regulation it cites.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg" className="bg-primary text-primary-foreground font-semibold px-6 shadow-sm gap-2">
              <Link to="/inspect">
                Open Inspection Workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-card font-medium">
              <Link to="/ask">Ask the Rules a Question</Link>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">{SHORT_DISCLAIMER}</p>
        </div>
      </section>

      {/* ------------------------------------------------ 2. Stats Bar */}
      <section className="border-b border-border/70 bg-card">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-4 px-4 py-8 sm:px-6 md:grid-cols-4">
          <Stat label="Statutory rules evaluated" value="31" />
          <Stat label="Gazette chunks indexed" value={corpus ? String(corpus.chunks) : "—"} />
          <Stat
            label="Source legal documents"
            value={corpus ? String(corpus.documents.length) : "—"}
          />
          <Stat label="Surfaces per package" value="Up to 6" />
        </div>
      </section>

      {/* ------------------------------------------------ 3. How an inspection runs */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-2 max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Inspection Architecture</span>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            How an inspection runs
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Four deterministic stages, each of which can stop and say it does not know. A stage that
            cannot verify a condition reports that rather than passing a guess downstream.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((step, index) => (
            <Card key={step.title} className="h-full border-l-3 border-l-primary/60 border-border/80 shadow-2xs">
              <CardHeader className="pb-3">
                <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg shadow-2xs">
                  <step.Icon className="size-4.5" />
                </div>
                <CardTitle className="mt-3 flex items-center gap-2 text-base font-bold text-foreground">
                  <span className="text-primary font-mono text-xs">
                    0{index + 1}
                  </span>
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground text-xs leading-relaxed">
                {step.body}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator />

      {/* ------------------------------------------------ 4. System Boundaries */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-2 max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Statutory Integrity</span>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What the system deliberately will not do
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The statutory constraints matter more than the features. This is an AI-assisted screening
            decision-support system for legal metrology officers, so its limits are essential to its legal integrity.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="border-border/80 shadow-2xs">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded bg-primary/10 text-primary">
                    <feature.Icon className="size-4.5" />
                  </div>
                  <CardTitle className="text-base font-bold text-foreground">{feature.title}</CardTitle>
                </div>
                <CardDescription className="pt-2 text-xs leading-relaxed text-muted-foreground">
                  {feature.body}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------ 5. Quick CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
        <Card className="border-border/80 shadow-xs bg-muted/20">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-foreground">Start screening a package</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Upload photographs of a product container or wrapper. The system evaluates declarations, displays highlighted visual evidence, and prepares a signed-off report for export.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-3">
            <Button asChild className="bg-primary text-primary-foreground font-semibold">
              <Link to="/inspect">
                Open Inspection Workspace
                <ArrowRight className="size-4 ml-1.5" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="bg-card">
              <Link to="/regulations">Browse Statutory Regulation Corpus</Link>
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6">
        <Disclaimer />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-lg border border-border/70 bg-muted/20">
      <span className="text-3xl font-bold tabular-nums text-foreground">{value}</span>
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
    </div>
  )
}
