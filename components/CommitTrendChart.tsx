// 週次コミット活動の棒グラフ（依存ゼロ・CSS の高さ % で表現）。
// Server Component のまま。ホバー時はネイティブ title でツールチップ表示。

import type { WeeklyPoint } from "@/lib/github/aggregate";

function formatWeek(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function CommitTrendChart({ data }: { data: WeeklyPoint[] }) {
  const nonEmpty = data.filter((d) => d.total >= 0);
  if (nonEmpty.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">アクティビティなし</p>;
  }

  const max = Math.max(...nonEmpty.map((d) => d.total), 1);
  const totalCommits = nonEmpty.reduce((acc, d) => acc + d.total, 0);

  return (
    <div>
      <div className="flex h-28 items-end gap-px" role="img" aria-label="週次コミット活動">
        {nonEmpty.map((d) => {
          const heightPct = (d.total / max) * 100;
          return (
            <div
              key={d.week}
              className="flex-1 rounded-t-sm bg-emerald-500/80 transition-colors hover:bg-emerald-400 dark:bg-emerald-500/70"
              style={{ height: `${Math.max(heightPct, d.total > 0 ? 4 : 1)}%` }}
              title={`${formatWeek(d.week)} の週: ${d.total} commits`}
            />
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        直近 {nonEmpty.length} 週 / 合計 {totalCommits.toLocaleString()} commits
      </p>
    </div>
  );
}
