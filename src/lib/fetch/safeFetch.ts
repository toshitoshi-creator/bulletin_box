import { assertUrlIsSafe } from "./ssrf";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB safety cap
const USER_AGENT = "WebShelfBot/1.0 (+content reader; respects robots.txt)";

export class FetchFailedError extends Error {
  code:
    | "NETWORK_ERROR"
    | "TIMEOUT"
    | "HTTP_403"
    | "HTTP_404"
    | "HTTP_429"
    | "HTTP_500"
    | "BLOCKED"
    | "TOO_LARGE";
  constructor(code: FetchFailedError["code"], message: string) {
    super(message);
    this.name = "FetchFailedError";
    this.code = code;
  }
}

export async function safeFetchText(
  rawUrl: string,
  opts: { timeoutMs?: number; accept?: string } = {}
): Promise<{ text: string; finalUrl: string; contentType: string }> {
  await assertUrlIsSafe(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(rawUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: opts.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new FetchFailedError("TIMEOUT", "サイトへの接続がタイムアウトしました。");
    }
    throw new FetchFailedError("NETWORK_ERROR", "サイトに接続できませんでした。");
  } finally {
    clearTimeout(timeout);
  }

  // Guard against redirects landing on a blocked internal address.
  await assertUrlIsSafe(res.url);

  if (!res.ok) {
    if (res.status === 403) throw new FetchFailedError("HTTP_403", "サイトからアクセスを拒否されました。");
    if (res.status === 404) throw new FetchFailedError("HTTP_404", "ページが見つかりませんでした。");
    if (res.status === 429) throw new FetchFailedError("HTTP_429", "リクエストが多すぎます。しばらく待ってから再試行してください。");
    if (res.status >= 500) throw new FetchFailedError("HTTP_500", "サイト側でエラーが発生しました。");
    throw new FetchFailedError("NETWORK_ERROR", `サイトが ${res.status} を返しました。`);
  }

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new FetchFailedError("TOO_LARGE", "コンテンツが大きすぎます。");
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    throw new FetchFailedError("TOO_LARGE", "コンテンツが大きすぎます。");
  }

  const contentType = res.headers.get("content-type") ?? "";
  const text = new TextDecoder("utf-8").decode(buf);
  return { text, finalUrl: res.url, contentType };
}
