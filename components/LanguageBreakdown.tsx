// 言語構成の横積みバー＋凡例（依存ゼロ）。

import { languageColor, type LanguageShare } from "@/lib/github/aggregate";

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function LanguageBreakdown({ shares }: { shares: LanguageShare[] }) {
  if (shares.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">言語データなし</p>;
  }

  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full"
        role="img"
        aria-label="言語構成"
      >
        {shares.map((s) => (
          <div
            key={s.name}
            style={{ width: `${s.percent * 100}%`, backgroundColor: languageColor(s.name) }}
            title={`${s.name}: ${formatPercent(s.percent)}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {shares.map((s) => (
          <li key={s.name} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: languageColor(s.name) }}
            />
            <span className="text-zinc-700 dark:text-zinc-300">{s.name}</span>
            <span className="text-zinc-400 dark:text-zinc-500">{formatPercent(s.percent)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
