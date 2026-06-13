// プルリクエストの取得と Conventional Commits 種別分類。
// 将来 組織/チームへ拡張する際も、取得元は同じ /repos/{o}/{r}/pulls。

import { ghFetchAll } from "@/lib/github/client";
import type { ConventionalType, PrTypeCount, PullRequestLite } from "@/lib/github/types";

/** /repos/{o}/{r}/pulls（list）の生レスポンス（必要分のみ） */
interface RawPull {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  created_at: string;
  user: { login: string } | null;
  html_url: string;
}

/**
 * 直近のマージ済み PR を取得（mergedAt 降順、最大 limit 件）。
 * list API は additions/deletions を返さないため v1 では個別 PR GET はしない。
 */
export async function getRecentMergedPulls(
  owner: string,
  repo: string,
  limit = 30,
): Promise<PullRequestLite[]> {
  // per_page=50 に抑える（100 件だと本文込みで 2MB を超え Next のキャッシュ上限に当たるため）。
  // closed の大半は merged なので 50 件あれば limit(=30) のマージ済みは十分得られる。
  const raw = await ghFetchAll<RawPull>(`/repos/${owner}/${repo}/pulls`, {
    searchParams: { state: "closed", sort: "updated", direction: "desc", per_page: 50 },
    revalidate: 300,
    maxPages: 1,
  });

  return raw
    .filter((p) => p.merged_at)
    .map((p) => ({
      number: p.number,
      title: p.title,
      body: p.body,
      mergedAt: p.merged_at,
      createdAt: p.created_at,
      user: p.user?.login ?? null,
      htmlUrl: p.html_url,
    }))
    .sort((a, b) => (b.mergedAt ?? "").localeCompare(a.mergedAt ?? ""))
    .slice(0, limit);
}

const TYPE_RE =
  /^\s*(feat|fix|refactor|docs|chore|test|style|perf|build|ci|revert)(\([^)]*\))?!?\s*:/i;

/** PR タイトルの接頭辞から Conventional Commits 種別を判定。 */
export function classifyPullType(title: string): ConventionalType {
  const m = title.match(TYPE_RE);
  return m ? (m[1].toLowerCase() as ConventionalType) : "other";
}

/** 種別ごとの件数（件数降順・非ゼロのみ）。 */
export function countPullTypes(pulls: PullRequestLite[]): PrTypeCount[] {
  const counts = new Map<ConventionalType, number>();
  for (const p of pulls) {
    const t = classifyPullType(p.title);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}
