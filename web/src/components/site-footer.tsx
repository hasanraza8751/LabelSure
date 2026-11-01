import { Scale } from "lucide-react"
import { SHORT_DISCLAIMER } from "@/components/disclaimer"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-card">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Scale className="size-4 text-primary" />
            <span>LabelSure — Legal Metrology Compliance Screening System</span>
          </div>
          <p className="text-muted-foreground">
            Built for Smart India Hackathon 2026 · Legal Metrology (Packaged Commodities) Rules, 2011
          </p>
        </div>
        <p className="max-w-md text-left sm:text-right text-[11px] leading-relaxed">
          {SHORT_DISCLAIMER}
        </p>
      </div>
    </footer>
  )
}
