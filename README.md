# GHTeam View

GitHub のリポジトリ（リモートリポジトリ）のデータにアクセスし、**チームの開発状況を可視化**して、そこから各メンバーの**プロジェクトへの貢献の評価（参考値）**を出すダッシュボードです。

> デモは個人リポジトリを対象にしていますが、データ取得を `lib/github/` に隔離しているため、取得元を組織/チーム（`/orgs/{org}/...`）へ差し替えるだけで本番に発展できます。

---

## 主な機能

### 1. ホームダッシュボード（`/`）
認証ユーザーの全リポジトリを横断集計します。
- リポジトリ一覧（言語・スター・最終更新・Open PR/Issue）
- 言語・技術スタック構成（全リポジトリ集計）
- コミット活動の推移（週次）
- トップコントリビューター

### 2. リポジトリ詳細（`/repos/[owner]/[repo]`）
- コミット活動の推移（直近52週）
- **PR / Issue 内訳**（open / merged / total。`open_issues_count` ではなく Search API で正確に分離）
- 言語・技術スタック構成
- メンバー別の貢献度（`stats/contributors`、202 のときは contributors リスト API にフォールバック）
- **AI で開発内容を分析**（後述）
- **貢献度スコア（メンバー評価）の要約**（後述・専用ページへリンク）

### 3. AI で開発内容を分析（ローカルAI・ストリーミング）
マージ済み PR をローカル AI が読み、**種別別サマリ（feat/fix/refactor…）＋ 開発ナラティブ**を日本語で生成します（Markdown 表示）。種別の件数はコードで確定算出し、AI には数値を作らせません。

### 4. メンバー評価（`/repos/[owner]/[repo]/scorecard`）
2 つの観点でメンバーを評価します。

- **絶対評価（AI採点・質ベース）** — 主役。
  コーディングを生成AIが担う前提で、コード量や速さではなく**人の知的貢献**を、他者と比較しない**絶対基準**で評価します。ローカル AI が各マージ済み PR を 4 観点で 0〜5 採点し、メンバー（PR author）ごとに平均します。
  - アイデア/新規性（0→1）／ 設計・アーキテクチャ ／ AIへの指示の明確さ（9→10）／ 完成度・仕上げ
  - 透明性のため、PR ごとの点数と理由をすべて表示します。
- **活動量（参考・相対）** — マージ済みPR / コミット / 変更行数のチーム内シェアを重み付き合成。重みはスライダーで即時調整できます。

> **評価についての注意**: これらは「評価の一参考」です。実際の AI へのプロンプトは GitHub に残らないため、評価対象は **PR本文＝人の意図・方向付けの記録**という代理シグナルです。小型ローカルモデルの主観・ブレもあるため、内訳・理由を必ず確認し、1on1 や成果物レビューと併用してください。

---

## 画面・APIルート

| パス | 種別 | 内容 |
|---|---|---|
| `/` | ページ | ホームダッシュボード |
| `/repos/[owner]/[repo]` | ページ | リポジトリ詳細 |
| `/repos/[owner]/[repo]/scorecard` | ページ | メンバー評価（絶対評価＋活動量） |
| `/api/repos/[owner]/[repo]/pr-analysis` | POST | PR 要約をテキストストリーム |
| `/api/repos/[owner]/[repo]/pr-quality` | POST | PR ルーブリック採点を NDJSON でストリーム |

任意の `owner/repo` を URL で直接開けるので、多人数の公開リポジトリ（例: `/repos/vercel/swr/scorecard`）で実ランキングも確認できます。

---

## 技術スタック

- **Next.js 16**（App Router）/ **React 19** / **TypeScript**
- **Tailwind CSS v4** ＋ `@tailwindcss/typography`
- `react-markdown` + `remark-gfm`（AI出力のMarkdown表示）
- GitHub アクセスは**素の fetch**（Octokit 不使用）。ローカル AI も**素の fetch**（AI SDK 不使用）。チャートは依存なしの自作 SVG/CSS。

---

## セットアップ

### 1. 依存インストール
```bash
npm install
```

### 2. 環境変数（`.env.local` をプロジェクト直下に作成）
`.env.example` をコピーして編集してください。**いずれもサーバー専用**（`NEXT_PUBLIC_` を付けない）。

```bash
# GitHub Personal Access Token（必須）
# スコープ: 公開リポジトリのみ=public_repo / 非公開も=repo / 将来の組織=read:org
GITHUB_TOKEN=ghp_xxxxx
# 任意（未指定なら GET /user で自動解決）
GITHUB_USERNAME=your-login

# ローカルAI（OpenAI 互換サーバ）。AI機能を使う場合に設定（既定値あり）
LOCAL_AI_BASE_URL=http://localhost:8080/v1
LOCAL_AI_MODEL=gemma-4-e4b-it-Q4_K_M.gguf
# 認証付きサーバのときのみ
# LOCAL_AI_API_KEY=
```

PAT の発行: GitHub → Settings → Developer settings → Personal access tokens。

### 3. ローカルAI（AI機能を使う場合）
「AIで開発内容を分析」「絶対評価（AI採点）」は **OpenAI 互換のローカル LLM サーバ**を使います（例: `llama.cpp` の `llama-server`、Ollama、LM Studio）。既定では `http://localhost:8080/v1` に接続します。未起動でもダッシュボード・活動量スコアは動作し、AI 機能のみエラー表示になります。

### 4. 開発サーバ起動
```bash
npm run dev
```
[http://localhost:3000](http://localhost:3000) を開く。環境変数は起動時に読み込まれるため、`.env.local` 変更後は再起動してください。

---

## アーキテクチャ

```
app/
  page.tsx                         ホームダッシュボード
  repos/[owner]/[repo]/
    page.tsx                       リポジトリ詳細
    scorecard/page.tsx             メンバー評価
  api/repos/[owner]/[repo]/
    pr-analysis/route.ts           PR要約ストリーム
    pr-quality/route.ts            PR採点ストリーム(NDJSON)
lib/
  github/                          GitHub データ取得層（＝組織/チームへの差し替え点）
    client.ts                      fetchラッパー（認証/キャッシュ/202リトライ/ページネーション）
    repos.ts / pulls.ts / contribution.ts / aggregate.ts / types.ts
  ai/                              ローカルAI連携
    client.ts                      streamChat（SSE）/ chatComplete（非ストリーミング・JSON）
    judge.ts / prompt.ts / protocol.ts
  scoring.ts                       活動量スコア（純粋・client/server共有）
  quality.ts                       絶対評価スコア（純粋・client/server共有）
components/                        表示部品（チャート/カード/パネル等）
```

設計上の要点:
- **データ取得層 `lib/github/` が seam**。個人 → 組織/チームは `listRepos`/`getMemberContributions` 等の取得元を差し替えるだけ。
- スコアロジック（`lib/scoring.ts` / `lib/quality.ts`）は**純粋関数**でサーバ／クライアント両方から使用。
- GitHub トークン・ローカルAI設定は**サーバー側のみ**で参照（クライアントへ渡さない）。
- キャッシュは `fetch` の `next: { revalidate, tags }`（Next の `cacheComponents` は未使用）。

---

## 補足

- Search API は 30req/分の別枠のため、メンバー別集計などは対象を上位N件に制限しています。
- GitHub の `stats/*` は初回 202（生成中）になり得るため、リトライ＋短期キャッシュ＋フォールバックで対応しています。
- 個人リポジトリはほぼ単独コントリビュータのため、ランキングの本領は多人数（組織/公開リポジトリ）で発揮されます。
