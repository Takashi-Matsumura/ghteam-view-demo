// Open PR / Open Issue 数のバッジ。

import type { OpenCounts } from "@/lib/github/types";

export function OpenCountsBadges({ counts, size = "sm" }: { counts: OpenCounts; size?: "sm" | "lg" }) {
  const base =
    size === "lg"
      ? "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium"
      : "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium";

  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={`${base} bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}
        title="Open Pull Requests"
      >
        PR {counts.prs}
      </span>
      <span
        className={`${base} bg-amber-500/10 text-amber-700 dark:text-amber-400`}
        title="Open Issues"
      >
        Issue {counts.issues}
      </span>
    </div>
  );
}
