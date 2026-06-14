"use client";

// マージ済みPRをローカルAIがルーブリック採点し、メンバーの絶対評価（質ベース）を表示。
// NDJSON を逐次受信し、進捗・メンバープロフィール・PR別内訳をライブ更新。

import { useEffect, useRef, useState } from "react";
import { aggregateQuality, RUBRIC, toScore100, type PrJudgment } from "@/lib/quality";

type Status = "idle" | "loading" | "done" | "error";

function DimBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-32 shrink-0 text-zinc-600 dark:text-zinc-300">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function PrQualityPanel({ owner, repo }: { owner: string; repo: string }) {
  const [judgments, setJudgments] = useState<PrJudgment[]>([]);
  const [total, setTotal] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function run() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError(null);
    setJudgments([]);
    setTotal(0);
    setSkipped(0);

    try {
      const res = await fetch(`/api/repos/${owner}/${repo}/pr-quality`, {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`リクエストに失敗しました (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const l of lines) {
          if (!l.trim()) continue;
          const msg = JSON.parse(l);
          if (msg.type === "meta") setTotal(msg.total);
          else if (msg.type === "judgment") setJudgments((prev) => [...prev, msg.data]);
          else if (msg.type === "skip") setSkipped((n) => n + 1);
          else if (msg.type === "error") setError(msg.message);
          else if (msg.type === "empty") setTotal(0);
        }
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

  const loading = status === "loading";
  const members = aggregateQuality(judgments);
  const judged = judgments.length;

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        マージ済みPRをローカルAIが4観点で採点した<strong>絶対評価（質ベース）</strong>です。コード量や速さではなく、アイデア・設計・AIへの指示・仕上げを見ます。AIの主観的判断であり、PRごとの理由も確認のうえ<strong>評価の一参考</strong>としてご利用ください。
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "採点中…" : "AIで絶対評価を実行"}
        </button>
        {loading && (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-md border border-black/[.12] px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] dark:border-white/[.15] dark:text-zinc-300 dark:hover:bg-white/[.06]"
          >
            停止
          </button>
        )}
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {loading
            ? `採点 ${judged}/${total}…（ローカルAI・数分かかります）`
            : status === "done"
              ? `${judged}件を採点${skipped ? `（${skipped}件スキップ）` : ""}`
              : "直近20件のマージ済みPRを対象"}
        </span>
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">エラー: {error}</p>}

      {status === "done" && total === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          マージ済みのプルリクエストがありません。
        </p>
      )}

      {/* メンバーごとの絶対プロフィール */}
      {members.map((m) => (
        <div
          key={m.login}
          className="rounded-lg border border-black/[.06] bg-white p-4 dark:border-white/[.1] dark:bg-zinc-950"
        >
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              {m.login}{" "}
              <span className="text-xs font-normal text-zinc-400">PR {m.prCount}件</span>
            </span>
            <span className="text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
              {toScore100(m.overall)}
              <span className="text-xs font-normal text-zinc-400"> /100</span>
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {RUBRIC.map((r) => (
              <DimBar key={r.key} label={r.label} value={m[r.key]} />
            ))}
          </div>

          {/* PRごとの内訳（透明性のため理由も表示） */}
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-zinc-500 dark:text-zinc-400">
              PRごとの採点を見る（{m.judgments.length}件）
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {m.judgments.map((j) => (
                <li
                  key={j.number}
                  className="rounded border border-black/[.05] p-2 text-xs dark:border-white/[.08]"
                >
                  <a
                    href={j.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    #{j.number} {j.title}
                  </a>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-zinc-500 dark:text-zinc-400">
                    <span>アイデア {j.ideation}</span>
                    <span>設計 {j.design}</span>
                    <span>指示 {j.direction}</span>
                    <span>仕上げ {j.completion}</span>
                  </div>
                  {j.reason && (
                    <p className="mt-1 text-zinc-500 dark:text-zinc-400">{j.reason}</p>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ))}
    </div>
  );
}
