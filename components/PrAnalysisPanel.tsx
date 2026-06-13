"use client";

// マージ済み PR をローカル AI で分析するパネル。ボタン起動のみ（読込で自動実行しない）。

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ANSWER_MARKER } from "@/lib/ai/protocol";

type Status = "idle" | "loading" | "done" | "error";

export function PrAnalysisPanel({ owner, repo }: { owner: string; repo: string }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 離脱時にストリームを中断（route の req.signal 経由で llama.cpp も止まる）。
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);
    setText("");

    try {
      const res = await fetch(`/api/repos/${owner}/${repo}/pr-analysis`, {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`リクエストに失敗しました (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((prev) => prev + decoder.decode(value, { stream: true }));
      }
      setStatus("done");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const loading = status === "loading";

  // ANSWER_MARKER より前=思考プロセス、後=本文。マーカー未到達なら全文が思考中。
  const markerIdx = text.indexOf(ANSWER_MARKER);
  const reasoning = (markerIdx >= 0 ? text.slice(0, markerIdx) : text).trim();
  const answer = markerIdx >= 0 ? text.slice(markerIdx + ANSWER_MARKER.length).trim() : "";
  const thinking = loading && !answer;

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "分析中…" : "AI で開発内容を分析"}
        </button>
        {loading && (
          <button
            type="button"
            onClick={stop}
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] dark:border-white/[.15] dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            停止
          </button>
        )}
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {thinking ? "ローカルAIが思考中…" : "ローカルAIで実行。初回は数秒かかります。"}
        </span>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">エラー: {error}</p>}

      {reasoning && (
        <details className="mt-4 rounded-lg border border-black/[.06] bg-zinc-50 dark:border-white/[.1] dark:bg-zinc-900" open={thinking}>
          <summary className="cursor-pointer px-4 py-2 text-xs text-zinc-500 dark:text-zinc-400">
            🤔 思考プロセス{thinking ? "（生成中…）" : ""}
          </summary>
          <div className="whitespace-pre-wrap px-4 pb-4 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {reasoning}
          </div>
        </details>
      )}

      {answer && (
        <div className="mt-4 rounded-lg border border-black/[.06] bg-white p-4 dark:border-white/[.1] dark:bg-zinc-950">
          <div className="prose prose-sm prose-zinc max-w-none dark:prose-invert prose-headings:scroll-m-0 prose-pre:bg-zinc-100 dark:prose-pre:bg-zinc-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
          {loading && <span className="animate-pulse text-zinc-400">▍</span>}
        </div>
      )}
    </div>
  );
}
