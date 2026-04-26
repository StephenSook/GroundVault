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
                  "absolute top-4 right-1/2 h-px w-full",
                  done ? "bg-forest" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium",
                done && "bg-forest text-primary-foreground",
                current && "bg-background border-2 border-forest text-forest",
                !done && !current && "bg-background border border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-xs",
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
