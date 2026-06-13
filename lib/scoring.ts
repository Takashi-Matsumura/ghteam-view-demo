// 貢献度スコアの純粋計算モジュール。
// サーバー専用 import を持たないため、クライアントコンポーネントからも安全に使える。
// Date/env/乱数は使わない（決定的・テスト容易）。

export interface ScoreWeights {
  mergedPrs: number;
  commits: number;
  churn: number;
}

/** 既定重み（PR重視。churn は水増ししやすいため低め）。 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  mergedPrs: 0.5,
  commits: 0.3,
  churn: 0.2,
};

/** スコア計算に投入する 1 メンバーの生メトリクス（サーバ→クライアントを跨ぐので直列化可能）。 */
export interface MemberContribution {
  login: string;
  avatarUrl: string;
  commits: number;
  additions: number;
  deletions: number;
  churn: number; // additions + deletions（利便のため事前計算）
  mergedPrs: number;
  /** false のとき contributors リストAPI由来＝churn は 0（「不明」であり「実際に0」ではない） */
  statsAvailable: boolean;
}

/** 1 シグナルの内訳（透明性のため raw 値・シェア・寄与pt を保持）。 */
export interface SignalBreakdown {
  raw: number;
  share: number; // 0..1（チーム合計に対する割合）
  contribution: number; // 0..100（現在の重みでこのシグナルが加えたスコア）
}

export interface ScoredMember extends MemberContribution {
  score: number; // 0..100 合成スコア
  rank: number; // 1始まり
  signals: {
    mergedPrs: SignalBreakdown;
    commits: SignalBreakdown;
    churn: SignalBreakdown;
  };
}

type SignalKey = keyof ScoreWeights;
const SIGNAL_KEYS: SignalKey[] = ["mergedPrs", "commits", "churn"];

/** 各メンバーの該当シグナルの生値 */
function rawValue(m: MemberContribution, key: SignalKey): number {
  return key === "churn" ? m.churn : key === "commits" ? m.commits : m.mergedPrs;
}

/** 重みを合計1へ正規化。全て0なら均等（1/3）。 */
function normalizeWeights(w: ScoreWeights): ScoreWeights {
  const sum = w.mergedPrs + w.commits + w.churn;
  if (sum <= 0) return { mergedPrs: 1 / 3, commits: 1 / 3, churn: 1 / 3 };
  return { mergedPrs: w.mergedPrs / sum, commits: w.commits / sum, churn: w.churn / sum };
}

/**
 * 合成スコアを算出し、score 降順（同点は commits 降順→login 昇順）で返す。
 * score(m) = 100 × Σ_k nw_k × share_k(m)、share_k = value/Σvalue（合計0なら0）。
 */
export function computeScores(
  members: MemberContribution[],
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): ScoredMember[] {
  if (members.length === 0) return [];

  const nw = normalizeWeights(weights);

  // シグナル別のチーム合計
  const totals: Record<SignalKey, number> = { mergedPrs: 0, commits: 0, churn: 0 };
  for (const m of members) {
    for (const k of SIGNAL_KEYS) totals[k] += rawValue(m, k);
  }

  const scored = members.map((m) => {
    const signals = {} as ScoredMember["signals"];
    let score = 0;
    for (const k of SIGNAL_KEYS) {
      const raw = rawValue(m, k);
      const share = totals[k] > 0 ? raw / totals[k] : 0;
      const contribution = 100 * nw[k] * share;
      score += contribution;
      signals[k] = { raw, share, contribution };
    }
    return { ...m, score, rank: 0, signals };
  });

  scored.sort(
    (a, b) => b.score - a.score || b.commits - a.commits || a.login.localeCompare(b.login),
  );
  scored.forEach((m, i) => (m.rank = i + 1));
  return scored;
}
