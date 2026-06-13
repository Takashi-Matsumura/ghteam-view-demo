// ホームダッシュボード：全リポジトリの集計ビュー＋リポジトリグリッド。

import {
  getCommitActivity,
  getContributors,
  getOpenCounts,
  getRepoLanguages,
  getViewerLogin,
  listRepos,
} from "@/lib/github/repos";
import {
  aggregateCommitActivity,
  aggregateContributors,
  aggregateLanguages,
} from "@/lib/github/aggregate";
import type { OpenCounts } from "@/lib/github/types";
import { MetricCard } from "@/components/MetricCard";
import { CommitTrendChart } from "@/components/CommitTrendChart";
import { LanguageBreakdown } from "@/components/LanguageBreakdown";
import { ContributorList } from "@/components/ContributorList";
import { RepoCard } from "@/components/RepoCard";

// 取得・集計する対象は直近 push 上位 N 件に絞る（API レート制限対策）。
const DISPLAY_LIMIT = 12;

function SetupNotice({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          セットアップが必要です
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          GitHub API へのアクセスに失敗しました。プロジェクト直下に{" "}
          <code className="rounded bg-black/[.06] px-1 py-0.5 dark:bg-white/10">.env.local</code>{" "}
          を作成し、PAT を設定してから dev サーバを再起動してください。
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
          {`GITHUB_TOKEN=ghp_xxxxx\nGITHUB_USERNAME=your-login`}
        </pre>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">詳細: {message}</p>
      </div>
    </main>
  );
}

export default async function Home() {
  let login: string;
  let repos: Awaited<ReturnType<typeof listRepos>>;
  try {
    [login, repos] = await Promise.all([getViewerLogin(), listRepos()]);
  } catch (err) {
    return <SetupNotice message={err instanceof Error ? err.message : String(err)} />;
  }

  const shown = repos.slice(0, DISPLAY_LIMIT);

  // リポジトリごとに必要データを並列取得（1 件の失敗で全体を落とさない）。
  const perRepo = await Promise.all(
    shown.map(async (repo) => {
      const o = repo.owner.login;
      const n = repo.name;
      const [langs, commits, contribs, counts] = await Promise.allSettled([
        getRepoLanguages(o, n),
        getCommitActivity(o, n),
        getContributors(o, n),
        getOpenCounts(o, n),
      ]);
      return {
        repo,
        languages: langs.status === "fulfilled" ? langs.value : {},
        commits: commits.status === "fulfilled" ? commits.value : null,
        contributors: contribs.status === "fulfilled" ? contribs.value : null,
        counts:
          counts.status === "fulfilled" ? counts.value : ({ prs: 0, issues: 0 } as OpenCounts),
      };
    }),
  );

  // フォークは集計から除外（upstream の統計で歪むため）。
  const forAggregate = perRepo.filter((p) => !p.repo.fork);
  const languageShares = aggregateLanguages(forAggregate.map((p) => p.languages));
  const commitTrend = aggregateCommitActivity(forAggregate.map((p) => p.commits));
  const topContributors = aggregateContributors(forAggregate.map((p) => p.contributors));

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          @{login} のアクティビティ
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          全 {repos.length} リポジトリ中、直近 push 上位 {shown.length} 件を集計
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <MetricCard
          title="コミット活動の推移"
          subtitle="表示対象リポジトリの週次合計"
          className="lg:col-span-2"
        >
          <CommitTrendChart data={commitTrend} />
        </MetricCard>

        <MetricCard title="言語・技術スタック構成" subtitle="バイト数ベースの集計">
          <LanguageBreakdown shares={languageShares} />
        </MetricCard>

        <MetricCard
          title="トップコントリビューター"
          subtitle="メンバー別の貢献度（コミット数）"
          className="lg:col-span-3"
        >
          <ContributorList contributors={topContributors} variant="aggregate" limit={10} />
        </MetricCard>
      </div>

      <h2 className="mt-10 mb-4 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
        リポジトリ
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {perRepo.map((p) => (
          <RepoCard key={p.repo.id} repo={p.repo} counts={p.counts} />
        ))}
      </div>
    </main>
  );
}
