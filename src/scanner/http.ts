export interface FetchResult {
  ok: boolean;
  status: number;
  headers: Headers;
  url: string;
  redirected: boolean;
  body: string;
  error?: string;
}

export async function safeFetch(
  url: string,
  opts: { timeoutMs: number; method?: string; maxBytes?: number; redirect?: RequestRedirect } = {
    timeoutMs: 8000,
  },
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  const maxBytes = opts.maxBytes ?? 256 * 1024;

  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      redirect: opts.redirect ?? "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Kalkan-Security-Scanner/0.1 (+https://github.com/kalkan)",
        Accept: "*/*",
      },
    });

    let body = "";
    if (res.body && (opts.method ?? "GET") !== "HEAD") {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = 0;
      while (received < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        body += decoder.decode(value, { stream: true });
      }
      try {
        await reader.cancel();
      } catch {
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      url: res.url,
      redirected: res.redirected,
      body,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      url,
      redirected: false,
      body: "",
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
