import * as React from "react"
import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: number
    max?: number
    indeterminate?: boolean
  }
>(({ className, value = 0, max = 100, indeterminate = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-gray-200",
      className
    )}
    {...props}
  >
    <div
      className={cn(
        "h-full flex-1 bg-blue-600 transition-all duration-300 ease-in-out",
        indeterminate ? "animate-pulse" : "w-full"
      )}
      style={
        indeterminate
          ? { width: "100%" }
          : { transform: `translateX(-${100 - (value / max) * 100}%)` }
      }
    />
  </div>
))
Progress.displayName = "Progress"

export { Progress }
