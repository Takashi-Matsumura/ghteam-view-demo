// リポジトリ詳細：当該リポジトリの 4 指標を表示。

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCommitActivity,
  getContributors,
  getOpenCounts,
  getRepo,
  getRepoLanguages,
} from "@/lib/github/repos";
import { aggregateLanguages, summarizeContributors } from "@/lib/github/aggregate";
import type { ContributorStat, Languages, OpenCounts, WeeklyCommit } from "@/lib/github/types";
import { MetricCard } from "@/components/MetricCard";
import { CommitTrendChart } from "@/components/CommitTrendChart";
import { LanguageBreakdown } from "@/components/LanguageBreakdown";
import { OpenCountsBadges } from "@/components/OpenCountsBadges";
import { ContributorList } from "@/components/ContributorList";

export default async function RepoDetail({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  const meta = await getRepo(owner, repo);
  if (!meta) notFound();

  // 4 指標を並列取得（1 件失敗してもページを落とさない）。
  const [langsR, commitsR, contribsR, countsR] = await Promise.allSettled([
    getRepoLanguages(owner, repo),
    getCommitActivity(owner, repo),
    getContributors(owner, repo),
    getOpenCounts(owner, repo),
  ]);

  const languages: Languages = langsR.status === "fulfilled" ? langsR.value : {};
  const commits: WeeklyCommit[] | null = commitsR.status === "fulfilled" ? commitsR.value : null;
  const contributors: ContributorStat[] | null =
    contribsR.status === "fulfilled" ? contribsR.value : null;
  const counts: OpenCounts = countsR.status === "fulfilled" ? countsR.value : { prs: 0, issues: 0 };

  const languageShares = aggregateLanguages([languages]);
  const contributorSummaries = contributors ? summarizeContributors(contributors) : [];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link
        href="/"
        className="text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← ダッシュボードへ戻る
      </Link>

      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {meta.full_name}
          </h1>
          {meta.description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{meta.description}</p>
          )}
        </div>
        <a
          href={meta.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-black/[.08] px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/[.04] dark:border-white/[.12] dark:text-zinc-300 dark:hover:bg-white/[.06]"
        >
          GitHub で開く ↗
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard title="コミット活動の推移" subtitle="直近 52 週" className="lg:col-span-2">
          {commits === null ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              統計を生成中です。数秒後に再読み込みしてください。
            </p>
          ) : (
            <CommitTrendChart data={commits} />
          )}
        </MetricCard>

        <MetricCard title="Open PR / Issue">
          <OpenCountsBadges counts={counts} size="lg" />
        </MetricCard>

        <MetricCard title="言語・技術スタック構成" subtitle="このリポジトリ">
          <LanguageBreakdown shares={languageShares} />
        </MetricCard>

        <MetricCard
          title="メンバー別の貢献度"
          subtitle="コントリビューター（コミット・追加/削除行）"
          className="lg:col-span-2"
        >
          {contributors === null ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              統計を生成中です。数秒後に再読み込みしてください。
            </p>
          ) : (
            <ContributorList contributors={contributorSummaries} variant="repo" />
          )}
        </MetricCard>
      </div>
    </main>
  );
}
