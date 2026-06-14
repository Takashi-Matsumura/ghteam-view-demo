// AIによる絶対評価（質ベース）の純粋モジュール。
// サーバー専用 import を持たないため、クライアントからも安全に使える。

/** 評価軸（ルーブリック）。 */
export const RUBRIC = [
  { key: "ideation", label: "アイデア/新規性", hint: "0→1 の着想・課題設定の独自性" },
  { key: "design", label: "設計・アーキテクチャ", hint: "構造・抽象化・意思決定の質" },
  { key: "direction", label: "AIへの指示の明確さ", hint: "9→10 要件・スコープ・配慮の方向付け" },
  { key: "completion", label: "完成度・仕上げ", hint: "テスト・堅牢化・ドキュメント" },
] as const;

export type RubricKey = (typeof RUBRIC)[number]["key"];

/** 1 PR の採点結果（0〜5）。 */
export interface PrJudgment {
  number: number;
  title: string;
  author: string;
  htmlUrl: string;
  ideation: number;
  design: number;
  direction: number;
  completion: number;
  reason: string;
}

/** メンバー（PR author）ごとの絶対評価。各軸は平均（0〜5）。 */
export interface MemberQuality {
  login: string;
  prCount: number;
  ideation: number;
  design: number;
  direction: number;
  completion: number;
  /** 4軸平均（0〜5） */
  overall: number;
  judgments: PrJudgment[];
}

const KEYS: RubricKey[] = ["ideation", "design", "direction", "completion"];

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * PR採点をメンバー（author）別に集計。各軸の平均と overall（4軸平均）を算出し、
 * overall 降順で返す。絶対評価（他メンバーで正規化しない）。
 */
export function aggregateQuality(judgments: PrJudgment[]): MemberQuality[] {
  const byAuthor = new Map<string, PrJudgment[]>();
  for (const j of judgments) {
    const list = byAuthor.get(j.author) ?? [];
    list.push(j);
    byAuthor.set(j.author, list);
  }

  const members: MemberQuality[] = [];
  for (const [login, list] of byAuthor) {
    const dims = {
      ideation: avg(list.map((j) => j.ideation)),
      design: avg(list.map((j) => j.design)),
      direction: avg(list.map((j) => j.direction)),
      completion: avg(list.map((j) => j.completion)),
    };
    const overall = avg(KEYS.map((k) => dims[k]));
    members.push({
      login,
      prCount: list.length,
      ...dims,
      overall,
      judgments: list.sort((a, b) => b.number - a.number),
    });
  }

  return members.sort((a, b) => b.overall - a.overall);
}

/** 0〜5 の overall を 0〜100 に換算（表示用）。 */
export function toScore100(overall: number): number {
  return Math.round(overall * 20 * 10) / 10;
}
