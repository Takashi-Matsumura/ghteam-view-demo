// PR 分析用のプロンプト組み立て。
// 種別件数はコードで算出した確定値を渡し、モデルには数値を作らせない。

import type { ChatMessage } from "@/lib/ai/client";
import { classifyPullType } from "@/lib/github/pulls";
import type { PrTypeCount, PullRequestLite } from "@/lib/github/types";

const BODY_MAX = 300;

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function truncateBody(body: string | null): string {
  if (!body) return "";
  const collapsed = body.replace(/\s+/g, " ").trim();
  return collapsed.length > BODY_MAX ? `${collapsed.slice(0, BODY_MAX)}…` : collapsed;
}

const SYSTEM_PROMPT = `あなたはソフトウェア開発の活動を分析するアシスタントです。
与えられた「マージ済みプルリクエスト一覧」と「種別別の件数（確定値）」をもとに、最終結果のみを日本語で出力してください。

# 厳守事項
- 前置き・思考過程・「ユーザーは〜を求めている」のようなメタ説明・段取りを一切書かない。いきなり下記の見出しから始める。
- 出力は次の2セクションのみ:
  ## 種別別サマリ
  （feat / fix / refactor などが何件で、それぞれ何を意味するか。件数は与えられた確定値を使い、数値を勝手に変えない）
  ## 開発ナラティブ
  （この期間に何を開発・改善してきたかを、事実に基づき自然な文章で要約。PR番号を適宜引用してよい）
- 推測しすぎない。簡潔に。Markdown の見出し(##)と箇条書きを使う。`;

export function buildPrAnalysisMessages(input: {
  repoFullName: string;
  pulls: PullRequestLite[];
  typeCounts: PrTypeCount[];
}): ChatMessage[] {
  const { repoFullName, pulls, typeCounts } = input;

  const dates = pulls.map((p) => p.mergedAt).filter(Boolean) as string[];
  const oldest = dates.length ? shortDate(dates[dates.length - 1]) : "—";
  const newest = dates.length ? shortDate(dates[0]) : "—";

  const countsLine = typeCounts.map((t) => `${t.type}=${t.count}`).join(", ");

  const prLines = pulls
    .map((p) => {
      const t = classifyPullType(p.title);
      const body = truncateBody(p.body);
      const bodyPart = body ? ` — ${body}` : "";
      return `#${p.number} [${t}] ${p.title} (${shortDate(p.mergedAt)})${bodyPart}`;
    })
    .join("\n");

  const userContent = `リポジトリ: ${repoFullName}
期間: ${oldest} 〜 ${newest}
種別件数（確定値）: ${countsLine}

マージ済みPR一覧（最大${pulls.length}件）:
${prLines}

上記をもとに、種別別サマリと開発ナラティブを日本語で書いてください。`;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];
}
