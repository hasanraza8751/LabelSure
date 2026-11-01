import { useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { Menu, Scale, ShieldCheck } from "lucide-react"

import { SignInDialog } from "@/components/sign-in-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/inspect", label: "Inspect" },
  { to: "/ask", label: "Ask the Rules" },
  { to: "/regulations", label: "Regulations" },
  { to: "/dashboard", label: "Dashboard" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-card/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Brand Identity */}
        <Link
          to="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-95"
        >
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-foreground font-sans">
                LabelSure
              </span>
              <span className="hidden rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary sm:inline-block">
                LM(PC)R 2011
              </span>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground tracking-tight leading-none">
              AI-assisted compliance screening
            </span>
          </div>
        </Link>

        {/* Right: Navigation items + Theme toggle */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-primary bg-primary/8 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <SignInDialog />
          </div>
          <ThemeToggle />

          {/* Mobile Navigation Sheet */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="flex items-center gap-2 text-left">
                  <div className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground">
                    <Scale className="size-4" />
                  </div>
                  <span>LabelSure Portal</span>
                </SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 py-4">
                <nav className="flex flex-col gap-1">
                  {NAV.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        pathname === item.to
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="pt-2 sm:hidden border-t">
                  <SignInDialog />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
