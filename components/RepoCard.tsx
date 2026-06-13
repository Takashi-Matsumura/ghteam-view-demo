// ホームのリポジトリグリッドに並ぶサマリタイル。詳細ページへリンク。

import Link from "next/link";
import { languageColor } from "@/lib/github/aggregate";
import type { OpenCounts, Repo } from "@/lib/github/types";
import { OpenCountsBadges } from "@/components/OpenCountsBadges";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export function RepoCard({ repo, counts }: { repo: Repo; counts?: OpenCounts }) {
  return (
    <Link
      href={`/repos/${repo.owner.login}/${repo.name}`}
      className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-white p-4 transition-colors hover:border-black/20 dark:border-white/[.12] dark:bg-zinc-950 dark:hover:border-white/30"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">{repo.name}</span>
        {repo.fork && (
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            fork
          </span>
        )}
      </div>

      <p className="line-clamp-2 min-h-[2.5rem] text-xs text-zinc-500 dark:text-zinc-400">
        {repo.description ?? "（説明なし）"}
      </p>

      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        {repo.language && (
          <span className="flex items-center gap-1">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: languageColor(repo.language) }}
            />
            {repo.language}
          </span>
        )}
        <span title="Stars">★ {repo.stargazers_count}</span>
        <span className="ml-auto" title="最終 push">
          {formatDate(repo.pushed_at)}
        </span>
      </div>

      {counts && <OpenCountsBadges counts={counts} />}
    </Link>
  );
}
