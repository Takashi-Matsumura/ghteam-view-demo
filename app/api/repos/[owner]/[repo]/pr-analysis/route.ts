// マージ済み PR を分析し、ローカル AI の出力をストリーミングする POST。
// 出力は「思考プロセス」+ ANSWER_MARKER + 「種別件数(確定値) + 本文」。
// GITHUB_TOKEN / LOCAL_AI_* はこのファイルと lib/ のみで参照（サーバー専用）。

import { getRecentMergedPulls, countPullTypes } from "@/lib/github/pulls";
import { getRepo } from "@/lib/github/repos";
import { streamChat, LocalAiError } from "@/lib/ai/client";
import { buildPrAnalysisMessages } from "@/lib/ai/prompt";
import { ANSWER_MARKER } from "@/lib/ai/protocol";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await ctx.params;

  const pulls = await getRecentMergedPulls(owner, repo, 30);

  if (pulls.length === 0) {
    return new Response(`${ANSWER_MARKER}この期間にマージ済みのプルリクエストがありません。`, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const typeCounts = countPullTypes(pulls);
  const meta = await getRepo(owner, repo);
  const messages = buildPrAnalysisMessages({
    repoFullName: meta?.full_name ?? `${owner}/${repo}`,
    pulls,
    typeCounts,
  });

  // 本文セクションの先頭に置く確定の種別件数（コード算出）。
  const header = `種別: ${typeCounts.map((t) => `${t.type} ${t.count}`).join(" / ")}\n\n`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answerStarted = false;
      const startAnswer = () => {
        if (!answerStarted) {
          answerStarted = true;
          controller.enqueue(encoder.encode(ANSWER_MARKER + header));
        }
      };

      try {
        for await (const d of streamChat(messages, { signal: req.signal })) {
          if (d.phase === "answer") startAnswer();
          controller.enqueue(encoder.encode(d.text));
        }
        // 思考のみで本文が出なかった場合も、本文セクションに案内を出す。
        if (!answerStarted) {
          startAnswer();
          controller.enqueue(
            encoder.encode("（モデルが本文を生成しませんでした。もう一度お試しください。）"),
          );
        }
      } catch (err) {
        // クライアント切断/中断時はコントローラが既に閉じているので書き込まない。
        if (!req.signal.aborted && !(err instanceof Error && err.name === "AbortError")) {
          startAnswer();
          const msg =
            err instanceof LocalAiError
              ? `\n\n[エラー] ${err.message}`
              : "\n\n[エラー] 分析の生成中に問題が発生しました。";
          controller.enqueue(encoder.encode(msg));
        }
      }
      try {
        controller.close();
      } catch {
        // 既に閉じている場合は無視
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
