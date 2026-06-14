// ローカル AI（llama.cpp の OpenAI 互換サーバ）への薄い fetch クライアント。
// 依存ゼロ。サーバー専用（route からのみ呼ぶ）。env をクライアントへ渡さない。

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LocalAiConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

export class LocalAiError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LocalAiError";
  }
}

/** env から設定を読む（既定値: llama.cpp @ :8080）。 */
export function getLocalAiConfig(): LocalAiConfig {
  return {
    baseUrl: process.env.LOCAL_AI_BASE_URL?.trim() || "http://localhost:8080/v1",
    model: process.env.LOCAL_AI_MODEL?.trim() || "gemma-4-e4b-it-Q4_K_M.gguf",
    apiKey: process.env.LOCAL_AI_API_KEY?.trim() || undefined,
  };
}

interface StreamOpts {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

/** ストリーミングの 1 デルタ。思考(reasoning)と本文(answer)を区別する。 */
export interface ChatDelta {
  phase: "reasoning" | "answer";
  text: string;
}

/**
 * OpenAI 互換 /chat/completions のストリーミング出力を逐次 yield。
 * SSE（data: {...} … data: [DONE]）を行バッファで解析（チャンク跨ぎの部分行を保持）。
 * gemma 等は思考を delta.reasoning_content、最終回答を delta.content に分けて出すため両方拾う。
 */
export async function* streamChat(
  messages: ChatMessage[],
  opts: StreamOpts = {},
): AsyncGenerator<ChatDelta, void, unknown> {
  const { baseUrl, model, apiKey } = getLocalAiConfig();
  const { signal, temperature = 0.4, maxTokens = 4096 } = opts;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, stream: true, temperature, max_tokens: maxTokens }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new LocalAiError(
      `ローカルAIに接続できません（${baseUrl} で llama.cpp が起動しているか確認してください）`,
      err,
    );
  }

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new LocalAiError(`ローカルAIがエラーを返しました: ${res.status} ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // 最後の部分行は次チャンクへ持ち越し

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json.choices?.[0]?.delta;
        const reasoning: string | undefined = delta?.reasoning_content;
        const content: string | undefined = delta?.content;
        if (reasoning) yield { phase: "reasoning", text: reasoning };
        if (content) yield { phase: "answer", text: content };
      } catch {
        // 部分 JSON は無視（次チャンクで補完される）
      }
    }
  }
}

interface CompleteOpts {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  /** true で response_format=json_object（構造化出力を要求） */
  jsonMode?: boolean;
  /** リクエストボディへ追加で混ぜるフィールド（例: chat_template_kwargs で思考無効化） */
  extraBody?: Record<string, unknown>;
}

/**
 * 非ストリーミングの補完。最終回答（content）を文字列で返す。
 * 採点など構造化出力に使う（jsonMode で JSON を強制）。
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: CompleteOpts = {},
): Promise<string> {
  const { baseUrl, model, apiKey } = getLocalAiConfig();
  const { signal, temperature = 0.2, maxTokens = 1024, jsonMode = false, extraBody } = opts;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...extraBody,
      }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw err;
    throw new LocalAiError(
      `ローカルAIに接続できません（${baseUrl} で llama.cpp が起動しているか確認してください）`,
      err,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new LocalAiError(`ローカルAIがエラーを返しました: ${res.status} ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}
