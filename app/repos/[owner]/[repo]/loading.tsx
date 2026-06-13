// リポジトリ詳細のローディングスケルトン。

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-6 h-7 w-72 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-black/[.08] bg-zinc-100 dark:border-white/[.12] dark:bg-zinc-900"
          />
        ))}
      </div>
    </main>
  );
}
