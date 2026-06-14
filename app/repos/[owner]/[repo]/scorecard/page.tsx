// 専用スコアカード：①AIによる絶対評価（質ベース・主役） ②活動量スコア（参考・相対）。

import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepo } from "@/lib/github/repos";
import { getMemberContributions } from "@/lib/github/contribution";
import { Scorecard } from "@/components/Scorecard";
import { PrQualityPanel } from "@/components/PrQualityPanel";

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
        メンバー評価
      </h1>
      <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        {meta.full_name} への各メンバーの貢献を評価します。
      </p>

      {/* 主役: AIによる絶対評価（質ベース） */}
      <section className="mb-10">
        <h2 className="mb-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          絶対評価（AI採点・質ベース）
        </h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          コード量ではなく、アイデア・設計・AIへの指示・仕上げの質を、他者と比較しない絶対基準で採点します。
        </p>
        <PrQualityPanel owner={owner} repo={repo} />
      </section>

      {/* 参考: 活動量（相対） */}
      <section className="border-t border-black/[.08] pt-8 dark:border-white/[.12]">
        <h2 className="mb-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          活動量（参考・相対）
        </h2>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          マージ済みPR・コミット・変更行数のチーム内シェア。重みはスライダーで調整できます（量の参考指標）。
        </p>
        <Scorecard members={members} />
      </section>
    </main>
  );
}
