// スコアカードのローディングスケルトン。

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 h-7 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mb-4 h-24 animate-pulse rounded-lg border border-black/[.08] bg-zinc-100 dark:border-white/[.12] dark:bg-zinc-900" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border border-black/[.08] bg-zinc-100 dark:border-white/[.12] dark:bg-zinc-900"
          />
        ))}
      </div>
    </main>
  );
}
