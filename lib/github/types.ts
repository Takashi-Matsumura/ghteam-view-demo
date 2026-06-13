// GitHub REST API のレスポンス型と、UI 用のビューモデル型。
// 必要なフィールドのみを拾った最小定義（デモ用途）。

/** GET /user の最小フィールド */
export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

/** GET /user/repos（および将来の /orgs/{org}/repos）の最小フィールド */
export interface Repo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  pushed_at: string | null;
  updated_at: string | null;
}

/** GET /repos/{owner}/{repo}/languages のレスポンス（言語名 → バイト数） */
export type Languages = Record<string, number>;

/** GET /repos/{owner}/{repo}/stats/commit_activity の 1 要素（週単位） */
export interface WeeklyCommit {
  /** 週開始の Unix epoch（秒） */
  week: number;
  /** その週の合計コミット数 */
  total: number;
  /** 曜日別（日〜土） */
  days: number[];
}

/** GET /repos/{owner}/{repo}/stats/contributors の 1 要素 */
export interface ContributorStat {
  author: {
    login: string;
    avatar_url: string;
  } | null;
  /** 総コミット数 */
  total: number;
  /** 週ごとの追加/削除/コミット */
  weeks: Array<{ w: number; a: number; d: number; c: number }>;
}

/** UI で扱うコントリビューター集計のビューモデル */
export interface ContributorSummary {
  login: string;
  avatarUrl: string;
  commits: number;
  additions: number;
  deletions: number;
}

/** Open PR / Open Issue 数 */
export interface OpenCounts {
  prs: number;
  issues: number;
}

/** GET /search/issues のレスポンス（total_count のみ利用） */
export interface SearchResult {
  total_count: number;
}
