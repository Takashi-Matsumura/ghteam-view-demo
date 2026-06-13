"use client";

// インタラクティブなメンバー評価スコアカード。重みスライダーでスコア・順位を即時再計算。
// data は props 受け取り（fetch しない）＝トークン非露出。

import { useState } from "react";
import {
  computeScores,
  DEFAULT_WEIGHTS,
  type MemberContribution,
  type ScoreWeights,
  type SignalBreakdown,
} from "@/lib/scoring";

const SIGNALS: { key: keyof ScoreWeights; label: string; hint?: string }[] = [
  { key: "mergedPrs", label: "マージ済みPR" },
  { key: "commits", label: "コミット" },
  { key: "churn", label: "変更行数", hint: "水増ししやすいため既定では低め" },
];

function pct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

function SignalRow({
  label,
  bd,
  dimmed,
  note,
}: {
  label: string;
  bd: SignalBreakdown;
  dimmed?: boolean;
  note?: string;
}) {
  return (
    <div className={dimmed ? "opacity-50" : ""}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-zinc-600 dark:text-zinc-300">
          {label} <span className="tabular-nums text-zinc-400">{bd.raw.toLocaleString()}</span>
          {note && <span className="ml-1 text-[10px] text-zinc-400">{note}</span>}
        </span>
        <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
          share {pct(bd.share)} ・ +{bd.contribution.toFixed(1)}pt
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${bd.share * 100}%` }}
        />
      </div>
    </div>
  );
}

export function Scorecard({ members }: { members: MemberContribution[] }) {
  // スライダー値は 0–100。computeScores 内で正規化されるのでそのまま渡す。
  const [weights, setWeights] = useState<ScoreWeights>({
    mergedPrs: DEFAULT_WEIGHTS.mergedPrs * 100,
    commits: DEFAULT_WEIGHTS.commits * 100,
    churn: DEFAULT_WEIGHTS.churn * 100,
  });

  const scored = computeScores(members, weights);
  const weightSum = weights.mergedPrs + weights.commits + weights.churn;

  if (members.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">メンバーデータがありません。</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 注意書き */}
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        このスコアは<strong>活動量ベースの相対的な目安</strong>です。コードの品質・難易度・レビューやメンタリング等は反映していません。評価の一参考としてご利用ください。
      </p>

      {/* 重みスライダー */}
      <div className="rounded-lg border border-black/[.06] bg-zinc-50 p-4 dark:border-white/[.1] dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">重み付け</span>
          <button
            type="button"
            onClick={() =>
              setWeights({
                mergedPrs: DEFAULT_WEIGHTS.mergedPrs * 100,
                commits: DEFAULT_WEIGHTS.commits * 100,
                churn: DEFAULT_WEIGHTS.churn * 100,
              })
            }
            className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          >
            重みリセット
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {SIGNALS.map((s) => {
            const value = weights[s.key];
            const effective = weightSum > 0 ? value / weightSum : 1 / 3;
            return (
              <label key={s.key} className="flex items-center gap-3 text-xs">
                <span className="w-28 shrink-0 text-zinc-600 dark:text-zinc-300">
                  {s.label}
                  {s.hint && <span className="block text-[10px] text-zinc-400">{s.hint}</span>}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(e) =>
                    setWeights((w) => ({ ...w, [s.key]: Number(e.target.value) }))
                  }
                  className="flex-1 accent-indigo-500"
                />
                <span className="w-12 shrink-0 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                  {pct(effective)}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* ランキング */}
      <ol className="flex flex-col gap-3">
        {scored.map((m) => (
          <li
            key={m.login}
            className="rounded-lg border border-black/[.06] bg-white p-4 dark:border-white/[.1] dark:bg-zinc-950"
          >
            <div className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-sm font-semibold tabular-nums text-zinc-400">
                {m.rank}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.avatarUrl}
                alt={m.login}
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800"
              />
              <span className="flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {m.login}
              </span>
              <span className="shrink-0 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                {m.score.toFixed(1)}
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2 pl-8">
              <SignalRow label="マージ済みPR" bd={m.signals.mergedPrs} />
              <SignalRow label="コミット" bd={m.signals.commits} />
              <SignalRow
                label="変更行数"
                bd={m.signals.churn}
                dimmed={!m.statsAvailable}
                note={!m.statsAvailable ? "コミット数のみ（統計生成中）" : undefined}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
