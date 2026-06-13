// 集計用の純粋関数群（副作用なし・テスト容易）。

import type { ContributorStat, ContributorSummary, Languages } from "@/lib/github/types";

/** チャートが扱う週次系列 */
export interface WeeklyPoint {
  week: number;
  total: number;
}

/** 言語シェア 1 件分 */
export interface LanguageShare {
  name: string;
  bytes: number;
  percent: number;
}

/** これ未満のシェアは「Other」へ束ねる */
const OTHER_THRESHOLD = 0.015;

/**
 * 複数リポジトリの言語バイト数を合算し、シェア降順で返す。
 * 単一リポジトリなら配列要素 1 つで呼べば per-repo 集計になる。
 */
export function aggregateLanguages(all: Languages[]): LanguageShare[] {
  const totals = new Map<string, number>();
  for (const langs of all) {
    for (const [name, bytes] of Object.entries(langs)) {
      totals.set(name, (totals.get(name) ?? 0) + bytes);
    }
  }

  const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  if (grandTotal === 0) return [];

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);

  const shares: LanguageShare[] = [];
  let otherBytes = 0;
  for (const [name, bytes] of sorted) {
    const percent = bytes / grandTotal;
    if (percent < OTHER_THRESHOLD) {
      otherBytes += bytes;
    } else {
      shares.push({ name, bytes, percent });
    }
  }
  if (otherBytes > 0) {
    shares.push({ name: "Other", bytes: otherBytes, percent: otherBytes / grandTotal });
  }
  return shares;
}

/**
 * 複数リポジトリの週次コミット活動を週（epoch）単位で合算し、昇順で返す。
 * null（生成中/取得不可）は無視する。
 */
export function aggregateCommitActivity(all: (WeeklyPoint[] | null)[]): WeeklyPoint[] {
  const totals = new Map<number, number>();
  for (const series of all) {
    if (!series) continue;
    for (const point of series) {
      totals.set(point.week, (totals.get(point.week) ?? 0) + point.total);
    }
  }
  return [...totals.entries()]
    .map(([week, total]) => ({ week, total }))
    .sort((a, b) => a.week - b.week);
}

/** ContributorStat[] を UI 用サマリへ変換（追加/削除行を合算） */
export function summarizeContributors(stats: ContributorStat[]): ContributorSummary[] {
  return stats
    .filter((s) => s.author)
    .map((s) => ({
      login: s.author!.login,
      avatarUrl: s.author!.avatar_url,
      commits: s.total,
      additions: s.weeks.reduce((acc, w) => acc + w.a, 0),
      deletions: s.weeks.reduce((acc, w) => acc + w.d, 0),
    }))
    .sort((a, b) => b.commits - a.commits);
}

/**
 * 複数リポジトリのコントリビューター統計を login 単位で合算し、
 * コミット数降順で返す（全体のトップコントリビューター用）。
 */
export function aggregateContributors(all: (ContributorStat[] | null)[]): ContributorSummary[] {
  const byLogin = new Map<string, ContributorSummary>();
  for (const stats of all) {
    if (!stats) continue;
    for (const summary of summarizeContributors(stats)) {
      const existing = byLogin.get(summary.login);
      if (existing) {
        existing.commits += summary.commits;
        existing.additions += summary.additions;
        existing.deletions += summary.deletions;
      } else {
        byLogin.set(summary.login, { ...summary });
      }
    }
  }
  return [...byLogin.values()].sort((a, b) => b.commits - a.commits);
}

/** 代表的な言語の色。未知の言語は決定的なフォールバック色。 */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Go: "#00ADD8",
  Rust: "#dea584",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Ruby: "#701516",
  PHP: "#4F5D95",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Dart: "#00B4AB",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Dockerfile: "#384d54",
  Other: "#9ca3af",
};

const FALLBACK_COLORS = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#06b6d4"];

export function languageColor(name: string): string {
  if (LANGUAGE_COLORS[name]) return LANGUAGE_COLORS[name];
  // 名前から決定的にフォールバック色を選ぶ
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}
