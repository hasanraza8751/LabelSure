import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"

/**
 * Consistent page title + description + optional badge, used at the top of
 * every route-level page for visual hierarchy.
 */
export function PageHeader({
  title,
  description,
  badge,
  actions,
  children,
}: {
  title: string
  description?: string
  badge?: { label: string; icon?: ReactNode }
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {badge && (
            <Badge variant="outline" className="gap-1.5 text-xs">
              {badge.icon}
              {badge.label}
            </Badge>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {description && (
        <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
      )}
      {children}
    </header>
  )
}
