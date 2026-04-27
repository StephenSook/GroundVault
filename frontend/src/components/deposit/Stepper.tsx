import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DepositStep } from "@/types";

const LABELS: Record<DepositStep, string> = {
  wrap: "Wrap",
  request: "Request",
  pending: "Pending",
  claim: "Claim",
};

interface StepperProps {
  order: DepositStep[];
  currentIndex: number;
}

export function Stepper({ order, currentIndex }: StepperProps) {
  return (
    <ol className="flex items-start justify-between max-w-xl">
      {order.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={step} className="flex flex-col items-center gap-2 flex-1 relative">
            {i > 0 && (
              <span
                className={cn(
                  "absolute top-4 right-1/2 h-px w-full transition-colors duration-500",
                  done ? "bg-forest" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-300 ease-out",
                done && "bg-forest text-primary-foreground scale-100",
                current && "bg-background border-2 border-forest text-forest scale-110 shadow-lg shadow-forest/20",
                !done && !current && "bg-background border border-border text-muted-foreground scale-100",
              )}
            >
              {done ? (
                // The `key` is tied to the done state so React remounts
                // this element when a step flips from pending to done,
                // re-firing the zoom-in animation. Without the key,
                // React reuses the DOM node and the CSS animation does
                // not replay.
                <Check
                  key={`check-${i}`}
                  className="h-4 w-4 animate-in zoom-in-50 duration-300"
                />
              ) : (
                <span
                  key={`num-${i}-${current ? "active" : "future"}`}
                  className="animate-in fade-in duration-200"
                >
                  {i + 1}
                </span>
              )}
              {current && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-2 border-forest/40 animate-ping"
                />
              )}
            </span>
            <span
              className={cn(
                "text-xs transition-colors duration-300",
                (done || current) ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
