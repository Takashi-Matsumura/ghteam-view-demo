// 専用スコアカード：メンバー別貢献度のインタラクティブ評価。

import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/github/repos";
import { getMemberContributions } from "@/lib/github/contribution";
import { Scorecard } from "@/components/Scorecard";

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  const meta = await getRepo(owner, repo);
  if (!meta) notFound();

  const members = await getMemberContributions(owner, repo);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <Link
        href={`/repos/${owner}/${repo}`}
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← {meta.full_name} の詳細へ戻る
      </Link>

      <h1 className="mt-2 mb-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        貢献度スコア（メンバー評価）
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        マージ済みPR・コミット・変更行数の重み付き合成スコア。重みは下のスライダーで調整できます。
      </p>

      <Scorecard members={members} />
    </main>
  );
}
