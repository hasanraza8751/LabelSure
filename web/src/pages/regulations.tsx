import { useCallback, useEffect, useState } from "react"
import { BookOpen, ExternalLink, FileText, Landmark, Search, X } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
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
  InputGroupInput,
} from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { CorpusDocument, CorpusStats, RegulationHit } from "@/lib/types"

export function RegulationsPage() {
  const [stats, setStats] = useState<CorpusStats | null>(null)
  const [documents, setDocuments] = useState<CorpusDocument[] | null>(null)
  const [query, setQuery] = useState("")
  const [scope, setScope] = useState<string | null>(null)
  const [results, setResults] = useState<RegulationHit[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.corpusStats().then(setStats).catch(() => setStats(null))
    api
      .corpusDocuments()
      .then((r) => setDocuments(r.documents))
      .catch(() => setDocuments([]))
  }, [])

  const fail = useCallback((error: unknown) => {
    toast.error(
      error instanceof ApiError ? error.message : "Could not reach the compliance API",
    )
  }, [])

  async function search(event?: React.FormEvent, withScope = scope) {
    event?.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    try {
      const response = await api.searchRegulations(query, 10, withScope ?? undefined)
      setResults(response.results)
      setNote(response.note)
      setBrowsing(false)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  /** Clicking a document opens it: every clause, in source order. */
  async function openDocument(document: string) {
    setScope(document)
    setBusy(true)
    try {
      if (query.trim()) {
        await search(undefined, document)
        return
      }
      const response = await api.browseDocument(document)
      setResults(response.results)
      setNote(response.note)
      setBrowsing(true)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  function clearScope() {
    setScope(null)
    setResults(null)
    setNote(null)
    setBrowsing(false)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Statutory Regulation Corpus"
        description="Official Legal Metrology (Packaged Commodities) Rules, 2011 and statutory Gazette notifications. Search indexed clauses by keyword or inspect official documents in source order."
        badge={{
          label: "Official Repository",
          icon: <Landmark className="size-3.5 text-primary" />,
        }}
      >
        {stats && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Badge variant="secondary" className="text-xs font-semibold bg-primary/10 text-primary border-primary/20">
              {stats.chunks} Gazette Clauses Indexed
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {stats.documents.length} Source Documents
            </Badge>
            <Badge variant="outline" className="text-xs font-medium">
              {stats.with_page_numbers} with Page References
            </Badge>
          </div>
        )}
      </PageHeader>

      <form onSubmit={search} className="flex flex-col gap-2">
        <InputGroup className="bg-card shadow-xs border-border/80 rounded-lg">
          <InputGroupAddon className="text-muted-foreground">
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search keywords: net quantity, retail sale price, date of manufacture, consumer care..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-sm placeholder:text-muted-foreground/70"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              disabled={busy || !query.trim()}
              className="bg-primary text-primary-foreground font-semibold px-4"
            >
              {busy && !browsing ? <Spinner data-icon /> : null}
              Search Gazette
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>

      {scope && (
        <div className="flex flex-wrap items-center gap-2 text-xs bg-muted/40 p-2.5 rounded-md border border-border/60">
          <span className="text-muted-foreground font-medium">
            {browsing ? "Browsing official document:" : "Filtered within document:"}
          </span>
          <Badge variant="secondary" className="gap-1.5 font-semibold text-foreground">
            <FileText className="size-3 text-primary" />
            {scope}
            <button
              type="button"
              onClick={clearScope}
              aria-label="Clear the document filter"
              className="hover:text-destructive cursor-pointer"
            >
              <X className="size-3" />
            </button>
          </Badge>
        </div>
      )}

      {/* Indexed Documents Directory */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BookOpen className="size-4.5 text-primary" />
            Indexed Statutory Documents
          </CardTitle>
          <CardDescription className="text-xs">
            Official regulations and amendment orders governing packaged commodity labelling in India.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-3">
          {documents === null ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border/60">
              {documents.map((doc) => (
                <li key={doc.document} className="py-1 first:pt-0 last:pb-0">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-lg p-2 transition-colors",
                      scope === doc.document ? "bg-primary/8 border border-primary/20" : "hover:bg-muted/50",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openDocument(doc.document)}
                      className="flex flex-1 items-center gap-3 text-left text-xs sm:text-sm font-medium text-foreground cursor-pointer"
                    >
                      <BookOpen className="text-primary size-4 shrink-0" />
                      <span className="flex-1 font-semibold">{doc.document}</span>
                      <Badge variant="outline" className="shrink-0 tabular-nums text-xs">
                        {doc.chunks} {doc.chunks === 1 ? "clause" : "clauses"}
                      </Badge>
                    </button>
                    {doc.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                        asChild
                      >
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open the source document for ${doc.document}`}
                          title="Open official Gazette document"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Search / Browsing Results */}
      {results !== null && results.length === 0 && (
        <Card className="border-border/80 shadow-xs">
          <CardContent className="py-10">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search className="size-8 text-muted-foreground" />
                </EmptyMedia>
                <EmptyTitle className="text-base font-semibold">No statutory clauses retrieved</EmptyTitle>
                <EmptyDescription className="text-xs">
                  {note ?? "No matching clause found in the indexed regulatory corpus. Manual legal verification required."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}

      {results?.map((hit) => (
        <Card key={hit.chunk_id} className="border-border/80 shadow-xs">
          <CardHeader className="pb-3 border-b bg-muted/10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge className="font-mono text-xs font-bold bg-primary text-primary-foreground">
                  {hit.rule_reference}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {hit.category}
                </Badge>
              </div>
              {typeof hit.score === "number" && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Relevance score: <span className="font-bold text-foreground">{hit.score.toFixed(2)}</span>
                </span>
              )}
            </div>
            <CardTitle className="text-base font-bold text-foreground pt-1">
              {hit.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 flex flex-col gap-3.5">
            <blockquote className="border-l-3 border-primary/50 bg-muted/25 p-3.5 rounded-r text-xs leading-relaxed text-foreground font-serif">
              &ldquo;{hit.text}&rdquo;
            </blockquote>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{hit.citation.document}</span>
                {hit.citation.page ? <span>· Page {hit.citation.page}</span> : null}
                {hit.citation.effective_date ? <span>· Effective {hit.citation.effective_date}</span> : null}
                {hit.citation.verified && (
                  <span className="text-emerald-600 font-medium">· Verified Gazette text</span>
                )}
              </div>
              {hit.citation.url && (
                <Button variant="link" size="sm" className="h-auto p-0 text-xs font-medium text-primary gap-1" asChild>
                  <a href={hit.citation.url} target="_blank" rel="noreferrer">
                    View official Gazette PDF
                    <ExternalLink className="size-3" />
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
