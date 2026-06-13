// GitHub REST API への薄い fetch ラッパー。
// - 認証ヘッダ・API バージョンを一元付与
// - Next.js のキャッシュ（revalidate / tags）をここで設定
// - stats 系の 202 Accepted（統計生成中）をリトライ
// - Link ヘッダによるページネーション
//
// このモジュールはサーバー専用。トークンはクライアントへ渡さない。

const BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

// stats が 202（生成中）のときのリトライ間隔（ミリ秒）。
// 長く待つと毎リクエストがブロックされ体感が悪いので、短い 1 回に留める。
// GitHub の計算は数十秒〜数分かかり得るため、最終的な解決は
// 「revalidate(60s) でキャッシュ失効 → 再取得」に委ねる。
const RETRY_BACKOFF_MS = [2000];

export interface GhFetchOpts {
  /** キャッシュの再検証秒数（既定 600 秒） */
  revalidate?: number;
  /** クエリパラメータ */
  searchParams?: Record<string, string | number>;
  /** 202（統計生成中）をリトライするか。stats 系のみ true */
  retryOn202?: boolean;
}

export interface GhResponse<T> {
  data: T | null;
  status: number;
  headers: Headers;
}

function getToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "GITHUB_TOKEN が設定されていません。.env.local に PAT を設定してください（未認証だと 60req/h で即制限に達します）。",
    );
  }
  return token;
}

function buildUrl(path: string, searchParams?: GhFetchOpts["searchParams"]): string {
  const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 単一リクエスト。202（retryOn202 時）はバックオフでリトライ。
 * 2xx 以外（202/204 を除く）は例外を投げる。
 */
export async function ghFetch<T>(path: string, opts: GhFetchOpts = {}): Promise<GhResponse<T>> {
  const { revalidate = 600, searchParams, retryOn202 = false } = opts;
  const url = buildUrl(path, searchParams);

  const maxAttempts = retryOn202 ? RETRY_BACKOFF_MS.length + 1 : 1;

  let res!: Response;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": API_VERSION,
      },
      next: { revalidate, tags: ["github"] },
    });

    // 統計生成中。リトライ余地があれば待って再試行。
    if (res.status === 202 && retryOn202 && attempt < maxAttempts - 1) {
      await sleep(RETRY_BACKOFF_MS[attempt]);
      continue;
    }
    break;
  }

  // 202（生成中のまま）/ 204（コンテンツなし）はデータ無しとして返す。
  if (res.status === 202 || res.status === 204) {
    return { data: null, status: res.status, headers: res.headers };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}\n${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as T;
  return { data, status: res.status, headers: res.headers };
}

/** Link ヘッダの rel="next" を抽出 */
function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

/**
 * ページネーションを辿って全件を結合して返す。
 * デモのため maxPages（既定 2 = 最大 200 件）で打ち切る。
 */
export async function ghFetchAll<T>(
  path: string,
  opts: GhFetchOpts & { maxPages?: number } = {},
): Promise<T[]> {
  const { maxPages = 2, searchParams, ...rest } = opts;
  const merged = { per_page: 100, ...searchParams };

  const out: T[] = [];
  let nextUrl: string | null = buildUrl(path, merged);

  for (let page = 0; page < maxPages && nextUrl; page++) {
    const res: GhResponse<T[]> = await ghFetch<T[]>(nextUrl, rest);
    if (res.data) out.push(...res.data);
    nextUrl = parseNextLink(res.headers.get("link"));
  }
  return out;
}
