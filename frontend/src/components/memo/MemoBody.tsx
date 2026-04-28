import type { ImpactMemo } from "@/types";
import { cn } from "@/lib/utils";

export function MemoBody({ memo }: { memo: ImpactMemo }) {
  return (
    <article className="rounded-lg border border-border bg-card p-10 space-y-8">
      <header>
        <h1 className="font-display text-4xl text-forest leading-tight">{memo.title}</h1>
        <p className="text-sm text-muted-foreground mt-3">{memo.preparedFor}</p>
      </header>
      {memo.sections.map((s, sectionIdx) => (
        <section key={s.title} className="space-y-3">
          <h2 className="font-display text-2xl text-forest border-b border-border pb-2">{s.title}</h2>
          {s.body.split("\n\n").map((p, i) => (
            <p
              key={i}
              className={cn(
                "text-sm leading-relaxed text-foreground/90",
                // Drop-cap on the very first paragraph of the very first
                // section. Editorial cue that says "this is a real
                // institutional document," not just a marketing page.
                sectionIdx === 0 &&
                  i === 0 &&
                  "first-letter:font-display first-letter:text-6xl first-letter:text-forest first-letter:float-left first-letter:mr-2 first-letter:leading-[0.85] first-letter:mt-1",
              )}
            >
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul className="space-y-2 pl-5 list-disc text-sm text-foreground/90">
              {s.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          {s.table && (
            <div className="rounded-md border border-border bg-secondary/40 divide-y divide-border">
              {s.table.map((row) => (
                <div key={row.label} className="flex justify-between px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </article>
  );
}
