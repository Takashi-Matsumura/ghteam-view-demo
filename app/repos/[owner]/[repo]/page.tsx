// リポジトリ詳細：指標表示 + ローカルAIによるPR分析。

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCommitActivity,
  getContributors,
  getContributorsFallback,
  getPullIssueStats,
  getRepo,
  getRepoLanguages,
} from "@/lib/github/repos";
import { getMemberContributions } from "@/lib/github/contribution";
import { aggregateLanguages, summarizeContributors } from "@/lib/github/aggregate";
import type {
  ContributorStat,
  ContributorSummary,
  Languages,
  PullIssueStats,
  WeeklyCommit,
} from "@/lib/github/types";
import { MetricCard } from "@/components/MetricCard";
import { CommitTrendChart } from "@/components/CommitTrendChart";
import { LanguageBreakdown } from "@/components/LanguageBreakdown";
import { ContributorList } from "@/components/ContributorList";
import { PrAnalysisPanel } from "@/components/PrAnalysisPanel";
import { ScorecardSummary } from "@/components/ScorecardSummary";

const ZERO_STATS: PullIssueStats = {
  prOpen: 0,
  prMerged: 0,
  prTotal: 0,
  issueOpen: 0,
  issueTotal: 0,
};

function StatBadge({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-medium ${tone}`}
    >
      {label} {value}
    </span>
  );
}

export default async function RepoDetail({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  const meta = await getRepo(owner, repo);
  if (!meta) notFound();

  // 各指標を並列取得（1 件失敗してもページを落とさない）。
  const [langsR, commitsR, contribsR, statsR] = await Promise.allSettled([
    getRepoLanguages(owner, repo),
    getCommitActivity(owner, repo),
    getContributors(owner, repo),
    getPullIssueStats(owner, repo),
  ]);

  const languages: Languages = langsR.status === "fulfilled" ? langsR.value : {};
  const commits: WeeklyCommit[] | null = commitsR.status === "fulfilled" ? commitsR.value : null;
  const contributors: ContributorStat[] | null =
    contribsR.status === "fulfilled" ? contribsR.value : null;
  const stats: PullIssueStats = statsR.status === "fulfilled" ? statsR.value : ZERO_STATS;

  const languageShares = aggregateLanguages([languages]);

  // 貢献度: stats が空/202 ならリスト API へフォールバック。
  let contributorSummaries: ContributorSummary[];
  let contributorSource: "stats" | "list" | "none";
  if (contributors && contributors.length > 0) {
    contributorSummaries = summarizeContributors(contributors);
    contributorSource = "stats";
  } else {
    const fb = await getContributorsFallback(owner, repo).catch(() => []);
    contributorSummaries = fb;
    contributorSource = fb.length > 0 ? "list" : "none";
  }

  // メンバー評価スコア（要約）。失敗してもページは落とさない。
  const members = await getMemberContributions(owner, repo).catch(() => []);

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

        <MetricCard title="PR / Issue 内訳" subtitle="open / merged / total">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-12 text-xs text-zinc-500 dark:text-zinc-400">PR</span>
              <StatBadge
                label="open"
                value={stats.prOpen}
                tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              />
              <StatBadge
                label="merged"
                value={stats.prMerged}
                tone="bg-violet-500/10 text-violet-700 dark:text-violet-400"
              />
              <StatBadge
                label="total"
                value={stats.prTotal}
                tone="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-12 text-xs text-zinc-500 dark:text-zinc-400">Issue</span>
              <StatBadge
                label="open"
                value={stats.issueOpen}
                tone="bg-amber-500/10 text-amber-700 dark:text-amber-400"
              />
              <StatBadge
                label="total"
                value={stats.issueTotal}
                tone="bg-zinc-500/10 text-zinc-700 dark:text-zinc-300"
              />
            </div>
          </div>
        </MetricCard>

        <MetricCard title="言語・技術スタック構成" subtitle="このリポジトリ">
          <LanguageBreakdown shares={languageShares} />
        </MetricCard>

        <MetricCard
          title="メンバー別の貢献度"
          subtitle={
            contributorSource === "list"
              ? "コミット数のみ（GitHub統計が生成中のため簡易表示）"
              : "コントリビューター（コミット・追加/削除行）"
          }
          className="lg:col-span-2"
        >
          {contributorSource === "none" ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              統計を生成中です。数秒後に再読み込みしてください。
            </p>
          ) : (
            <ContributorList
              contributors={contributorSummaries}
              variant={contributorSource === "list" ? "aggregate" : "repo"}
            />
          )}
        </MetricCard>

        <MetricCard
          title="貢献度スコア（メンバー評価）"
          subtitle="既定の重み（PR重視）でのランキング"
        >
          <ScorecardSummary owner={owner} repo={repo} members={members} />
        </MetricCard>

        <MetricCard
          title="AI で開発内容を分析"
          subtitle="マージ済み PR をローカル AI が読んで言語化"
          className="lg:col-span-3"
        >
          <PrAnalysisPanel owner={owner} repo={repo} />
        </MetricCard>
      </div>
    </main>
  );
}
