// 詳細ページ用のコンパクトな貢献度ランキング（既定の重み）。フルのスコアカードへリンク。

import Link from "next/link";
import { computeScores, DEFAULT_WEIGHTS, type MemberContribution } from "@/lib/scoring";

export function ScorecardSummary({
  owner,
  repo,
  members,
  limit = 3,
}: {
  owner: string;
  repo: string;
  members: MemberContribution[];
  limit?: number;
}) {
  const scored = computeScores(members, DEFAULT_WEIGHTS).slice(0, limit);

  return (
    <div className="flex flex-col gap-3">
      {scored.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">メンバーデータがありません。</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {scored.map((m) => (
            <li key={m.login} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                {m.rank}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.avatarUrl}
                alt={m.login}
                width={24}
                height={24}
                className="size-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800"
              />
              <span className="flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
                {m.login}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-indigo-600 dark:text-indigo-400">
                {m.score.toFixed(1)}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Link
        href={`/repos/${owner}/${repo}/scorecard`}
        className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        詳しいスコアカードを見る →
      </Link>
    </div>
  );
}
