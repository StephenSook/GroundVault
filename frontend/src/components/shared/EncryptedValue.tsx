import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface EncryptedValueProps {
  handle: string;
  /** Plaintext shown only when current viewer is the ACL holder. */
  decrypted?: string;
  /** True if the current viewer is allowed to see plaintext. */
  authorized?: boolean;
  className?: string;
  variant?: "inline" | "stacked";
  label?: string;
}

/**
 * Renders an encrypted value as its on-chain handle.
 * If the viewer is in the ACL set, also displays the decrypted plaintext.
 */
export function EncryptedValue({
  handle,
  decrypted,
  authorized,
  className,
  variant = "stacked",
  label,
}: EncryptedValueProps) {
  const [show, setShow] = useState(true);
  const canDecrypt = Boolean(authorized && decrypted);

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <span className="font-mono text-xs text-muted-foreground">{handle.slice(0, 10)}…</span>
        {canDecrypt && show && <span className="font-medium">{decrypted}</span>}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>}
      <div className="flex items-center justify-between gap-3">
        {canDecrypt && show ? (
          <span className="font-display text-lg text-foreground">{decrypted}</span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground truncate">{handle}</span>
        )}
        {canDecrypt && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={show ? "Hide plaintext" : "Show plaintext"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {canDecrypt && show && (
        <span className="font-mono text-[10px] text-muted-foreground/70 truncate">{handle}</span>
      )}
    </div>
  );
}
