// PR をルーブリックで採点するロジック（サーバー専用）。
// AI支援開発を前提に、コード量でなく「人の知的貢献」を絶対評価する。

import { chatComplete, type ChatMessage } from "@/lib/ai/client";
import type { PullRequestLite } from "@/lib/github/types";
import type { PrJudgment } from "@/lib/quality";

const BODY_MAX = 1500;

function truncate(body: string | null): string {
  if (!body) return "（本文なし）";
  const t = body.replace(/\r/g, "").trim();
  return t.length > BODY_MAX ? `${t.slice(0, BODY_MAX)}…` : t;
}

const SYSTEM_PROMPT = `あなたはソフトウェアPRの評価者です。コーディングは生成AIが行う前提で、コード量や速さではなく「人の知的貢献」を絶対評価します（他のPRや他者との比較はしない）。
次の4観点を各0〜5の整数で採点してください。
- ideation: 0→1の新しいアイデア・課題設定の独自性（ゼロから何かを生み出したか）
- design: 設計・アーキテクチャの質（構造・抽象化・意思決定の妥当性）
- direction: AIへの指示・要件・スコープ・エッジケース配慮の明確さ（9→10の方向付け）
- completion: テスト・堅牢化・ドキュメント等、完成に向けた仕上げ

採点基準: 0=該当なし/定型作業, 3=標準的, 5=卓越。事実に基づき、PR本文から読み取れる範囲で評価する。
JSONオブジェクトのみを出力（前置き禁止）。形式:
{"ideation":n,"design":n,"direction":n,"completion":n,"reason":"40字以内の根拠"}`;

export function buildJudgeMessages(pr: PullRequestLite): ChatMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `PRタイトル: ${pr.title}\nPR本文:\n${truncate(pr.body)}`,
    },
  ];
}

const clamp05 = (n: unknown): number => {
  const x = Math.round(Number(n));
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(5, x));
};

/** 1 PR を採点。JSON parse 失敗時は null。 */
export async function judgePr(
  pr: PullRequestLite,
  opts?: { signal?: AbortSignal },
): Promise<PrJudgment | null> {
  const content = await chatComplete(buildJudgeMessages(pr), {
    jsonMode: true,
    maxTokens: 512,
    temperature: 0.2,
    signal: opts?.signal,
    // gemma の思考を無効化 → 即座に JSON を返し高速・確実（思考でトークンを使い切る問題を回避）。
    extraBody: { chat_template_kwargs: { enable_thinking: false } },
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  return {
    number: pr.number,
    title: pr.title,
    author: pr.user ?? "unknown",
    htmlUrl: pr.htmlUrl,
    ideation: clamp05(parsed.ideation),
    design: clamp05(parsed.design),
    direction: clamp05(parsed.direction),
    completion: clamp05(parsed.completion),
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}
