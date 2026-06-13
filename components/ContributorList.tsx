// コントリビューター（擬似メンバー）の貢献度リスト。
// variant="aggregate": 全リポジトリ集計のトップ貢献者
// variant="repo": 単一リポジトリの追加/削除行込み

import type { ContributorSummary } from "@/lib/github/types";

export function ContributorList({
  contributors,
  variant = "repo",
  limit,
}: {
  contributors: ContributorSummary[];
  variant?: "aggregate" | "repo";
  limit?: number;
}) {
  const rows = limit ? contributors.slice(0, limit) : contributors;

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">コントリビューターデータなし</p>;
  }

  const maxCommits = Math.max(...rows.map((c) => c.commits), 1);

  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((c, i) => (
        <li key={c.login} className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-400">
            {i + 1}
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={c.avatarUrl}
            alt={c.login}
            width={24}
            height={24}
            className="size-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">{c.login}</span>
              <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {c.commits.toLocaleString()} commits
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${(c.commits / maxCommits) * 100}%` }}
              />
            </div>
            {variant === "repo" && (
              <div className="mt-1 flex gap-3 text-xs tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">
                  +{c.additions.toLocaleString()}
                </span>
                <span className="text-rose-600 dark:text-rose-400">
                  −{c.deletions.toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
