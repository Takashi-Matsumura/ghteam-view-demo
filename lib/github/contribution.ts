// メンバー別貢献メトリクスの組み立て（サーバー専用）。
// commits/churn は contributors（stats→fallback）から、merged PR は Search から取得。

import { cache } from "react";
import { ghFetch } from "@/lib/github/client";
import { getContributors, getContributorsFallback } from "@/lib/github/repos";
import { summarizeContributors } from "@/lib/github/aggregate";
import type { SearchResult } from "@/lib/github/types";
import type { MemberContribution } from "@/lib/scoring";

// Search は 30req/分の別枠。メンバー別 Search を打つ上限。
const MAX_MEMBERS = 20;

/** author がこのリポジトリでマージした PR 数（Search 1回・total_count）。 */
export async function getMergedPrCountByAuthor(
  owner: string,
  repo: string,
  login: string,
): Promise<number> {
  try {
    const res = await ghFetch<SearchResult>("/search/issues", {
      searchParams: {
        q: `repo:${owner}/${repo} type:pr is:merged author:${login}`,
        per_page: 1,
      },
      revalidate: 300,
    });
    return res.data?.total_count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * メンバー別の貢献メトリクスを組み立てる。
 * 詳細ページと scorecard ページで共有できるよう cache() でラップ。
 */
export const getMemberContributions = cache(
  async (
    owner: string,
    repo: string,
    opts?: { limit?: number },
  ): Promise<MemberContribution[]> => {
    const limit = Math.min(opts?.limit ?? MAX_MEMBERS, MAX_MEMBERS);

    // メンバー一覧＋commits＋churn。stats が 202/空なら list API へフォールバック。
    const stats = await getContributors(owner, repo);
    let base;
    let statsAvailable: boolean;
    if (stats && stats.length > 0) {
      base = summarizeContributors(stats);
      statsAvailable = true;
    } else {
      base = await getContributorsFallback(owner, repo).catch(() => []);
      statsAvailable = false; // churn は不明（0）
    }

    if (base.length === 0) return [];

    // 上位 limit 人（いずれも commits 降順済）。超過は Search 上限のため打ち切り。
    const top = base.slice(0, limit);
    if (base.length > limit) {
      console.warn(
        `[scorecard] ${owner}/${repo}: コントリビューター ${base.length}→${limit} 人に制限（Search上限）`,
      );
    }

    // メンバー別の merged PR を並列取得（≤ limit 回の Search）。
    const prCounts = await Promise.all(
      top.map((c) => getMergedPrCountByAuthor(owner, repo, c.login)),
    );

    return top.map((c, i) => ({
      login: c.login,
      avatarUrl: c.avatarUrl,
      commits: c.commits,
      additions: c.additions,
      deletions: c.deletions,
      churn: c.additions + c.deletions,
      mergedPrs: prCounts[i],
      statsAvailable,
    }));
  },
);
