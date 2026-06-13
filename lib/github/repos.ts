// データ取得層（差し替えの seam）。
// 個人リポジトリ向けの実装。将来は listRepos/getViewerLogin の本体を
// 組織向け（GET /orgs/{org}/repos, /orgs/{org}/teams/{slug}/members）に
// 差し替えるだけで本番に発展できる。

import { cache } from "react";
import { ghFetch, ghFetchAll } from "@/lib/github/client";
import type {
  ContributorStat,
  GitHubUser,
  Languages,
  OpenCounts,
  Repo,
  SearchResult,
  WeeklyCommit,
} from "@/lib/github/types";

/** 認証ユーザーのログイン名。GITHUB_USERNAME 優先、無ければ GET /user。 */
export const getViewerLogin = cache(async (): Promise<string> => {
  const fromEnv = process.env.GITHUB_USERNAME?.trim();
  if (fromEnv) return fromEnv;

  const res = await ghFetch<GitHubUser>("/user", { revalidate: 3600 });
  if (!res.data) throw new Error("GET /user がユーザー情報を返しませんでした。");
  return res.data.login;
});

/**
 * 自分が所有するリポジトリ一覧（直近 push 順）。
 * 将来の組織切替: GET /orgs/{GITHUB_ORG}/repos?type=all&sort=pushed
 */
export const listRepos = cache(async (): Promise<Repo[]> => {
  return ghFetchAll<Repo>("/user/repos", {
    searchParams: { affiliation: "owner", sort: "pushed" },
    revalidate: 600,
  });
});

/** 単一リポジトリのメタ情報。存在しなければ null。 */
export async function getRepo(owner: string, repo: string): Promise<Repo | null> {
  try {
    const res = await ghFetch<Repo>(`/repos/${owner}/${repo}`, { revalidate: 600 });
    return res.data;
  } catch {
    return null;
  }
}

/** リポジトリの言語別バイト数。 */
export async function getRepoLanguages(owner: string, repo: string): Promise<Languages> {
  const res = await ghFetch<Languages>(`/repos/${owner}/${repo}/languages`, { revalidate: 3600 });
  return res.data ?? {};
}

/**
 * 週次コミット活動（直近 52 週）。
 * 生成中（202）で取得できない場合は null。
 */
export async function getCommitActivity(
  owner: string,
  repo: string,
): Promise<WeeklyCommit[] | null> {
  // stats は初回 202（生成中）になり得る。その 202 を長くキャッシュすると
  // 計算完了後もしばらく復活しないため、短め(60s)にして自己回復を早める。
  const res = await ghFetch<WeeklyCommit[]>(`/repos/${owner}/${repo}/stats/commit_activity`, {
    revalidate: 60,
    retryOn202: true,
  });
  return res.data;
}

/**
 * コントリビューター統計。
 * 生成中（202）で取得できない場合は null。
 */
export async function getContributors(
  owner: string,
  repo: string,
): Promise<ContributorStat[] | null> {
  // stats の 202（生成中）を長くキャッシュしないよう短め(60s)に。
  const res = await ghFetch<ContributorStat[]>(`/repos/${owner}/${repo}/stats/contributors`, {
    revalidate: 60,
    retryOn202: true,
  });
  return res.data;
}

/**
 * Open PR / Open Issue 数。
 * repo.open_issues_count は PR を含むため使わず、Search API で分離する。
 * Search API は 30req/分の別枠なので、呼び出し側で対象を絞ること。
 */
export async function getOpenCounts(owner: string, repo: string): Promise<OpenCounts> {
  const search = (type: "pr" | "issue") =>
    ghFetch<SearchResult>("/search/issues", {
      searchParams: { q: `repo:${owner}/${repo} type:${type} state:open`, per_page: 1 },
      revalidate: 300,
    });

  const [prs, issues] = await Promise.all([search("pr"), search("issue")]);
  return {
    prs: prs.data?.total_count ?? 0,
    issues: issues.data?.total_count ?? 0,
  };
}
