// マージ済み PR をローカル AI が 1 件ずつルーブリック採点し、NDJSON で逐次返す POST。
// 逐次なのは単一ローカルモデルを詰まらせないため＆進捗をストリームするため。

import { getRecentMergedPulls } from "@/lib/github/pulls";
import { judgePr } from "@/lib/ai/judge";
import { LocalAiError } from "@/lib/ai/client";

const LIMIT = 20;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ owner: string; repo: string }> },
) {
  const { owner, repo } = await ctx.params;
  const pulls = await getRecentMergedPulls(owner, repo, LIMIT);

  const encoder = new TextEncoder();
  const line = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (pulls.length === 0) {
        controller.enqueue(line({ type: "empty" }));
        controller.close();
        return;
      }

      controller.enqueue(line({ type: "meta", total: pulls.length }));

      try {
        for (const pr of pulls) {
          if (req.signal.aborted) break;
          const judgment = await judgePr(pr, { signal: req.signal });
          if (judgment) {
            controller.enqueue(line({ type: "judgment", data: judgment }));
          } else {
            controller.enqueue(line({ type: "skip", number: pr.number, title: pr.title }));
          }
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError") && !req.signal.aborted) {
          const message =
            err instanceof LocalAiError ? err.message : "採点中に問題が発生しました。";
          controller.enqueue(line({ type: "error", message }));
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
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
