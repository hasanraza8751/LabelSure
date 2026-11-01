import { Fragment, type ReactNode } from "react"
import { Check, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Horizontal pipeline stepper for the inspect workflow.
 *
 * Visualises:   Image → Quality → OCR → Extraction → Rules → Result
 *
 * Each step can be pending, active (spinner), complete (check), or error (x).
 * The connector line between steps fills as stages complete.
 */

export type StepStatus = "pending" | "active" | "complete" | "error"

export interface StepItem {
  label: string
  icon: ReactNode
  status: StepStatus
}

export function StepIndicator({
  steps,
  className,
}: {
  steps: StepItem[]
  className?: string
}) {
  return (
    <div
      className={cn("flex w-full items-start justify-between", className)}
      role="list"
      aria-label="Inspection pipeline"
    >
      {steps.map((step, index) => (
        <Fragment key={step.label}>
          {index > 0 && (
            <div className="mt-4 flex flex-1 items-center px-1">
              <div
                className={cn(
                  "h-px w-full transition-colors duration-300",
                  step.status === "complete" || step.status === "active"
                    ? "bg-primary"
                    : step.status === "error"
                      ? "bg-red-500"
                      : "bg-border",
                )}
              />
            </div>
          )}
          <div
            role="listitem"
            aria-current={step.status === "active" ? "step" : undefined}
            className={cn(
              "flex flex-col items-center gap-1.5",
              step.status === "active" && "text-primary",
              step.status === "complete" && "text-emerald-500",
              step.status === "error" && "text-red-500",
              step.status === "pending" && "text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border transition-colors",
                step.status === "active" &&
                  "border-primary bg-primary/10 shadow-sm shadow-primary/20",
                step.status === "complete" &&
                  "border-emerald-500/50 bg-emerald-500/10",
                step.status === "error" && "border-red-500/50 bg-red-500/10",
                step.status === "pending" && "border-border bg-muted",
              )}
            >
              {step.status === "active" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : step.status === "complete" ? (
                <Check className="size-4" />
              ) : step.status === "error" ? (
                <X className="size-4" />
              ) : (
                <span className="flex size-4 items-center justify-center [&>svg]:size-3.5">
                  {step.icon}
                </span>
              )}
            </div>
            <span
              className={cn(
                "max-w-16 text-center text-[10px] font-medium leading-tight",
                step.status === "active" && "text-primary",
                step.status === "complete" && "text-emerald-500",
                step.status === "error" && "text-red-500",
              )}
            >
              {step.label}
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  )
}
