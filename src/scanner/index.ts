import { cookiesModule } from "./modules/cookies";
import { corsModule } from "./modules/cors";
import { dnsModule } from "./modules/dns";
import { emailModule } from "./modules/email";
import { exposedModule } from "./modules/exposed";
import { headersModule } from "./modules/headers";
import { mixedContentModule } from "./modules/mixed";
import { portsModule } from "./modules/ports";
import { redirectModule } from "./modules/redirect";
import { subdomainsModule } from "./modules/subdomains";
import { techModule } from "./modules/tech";
import { tlsModule } from "./modules/tls";
import { wordpressModule } from "./modules/wordpress";
import { computeOverall, summarize, toGrade } from "./scoring";
import type { ModuleResult, ScanContext, ScanEvent, ScanReport } from "./types";

export * from "./types";

export const MODULES = [
  tlsModule,
  redirectModule,
  headersModule,
  cookiesModule,
  exposedModule,
  portsModule,
  emailModule,
  corsModule,
  mixedContentModule,
  wordpressModule,
  dnsModule,
  subdomainsModule,
  techModule,
];

export function buildContext(input: string, timeoutMs = 8000): ScanContext {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  const parsed = new URL(raw);
  const host = parsed.hostname;

  if (isPrivateHost(host)) {
    throw new Error("Yerel veya özel ağ adresleri taranamaz.");
  }

  return {
    url: `${parsed.protocol}//${host}`,
    host,
    protocol: parsed.protocol === "http:" ? "http:" : "https:",
    timeoutMs,
  };
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

export async function scan(input: string, timeoutMs?: number): Promise<ScanReport> {
  const modules: ModuleResult[] = [];
  for await (const event of scanStream(input, timeoutMs)) {
    if (event.type === "module") modules.push(event.result);
    if (event.type === "done") return event.report;
    if (event.type === "error") throw new Error(event.message);
  }
  throw new Error("Tarama tamamlanamadı.");
}

export async function* scanStream(input: string, timeoutMs?: number): AsyncGenerator<ScanEvent> {
  let ctx: ScanContext;
  try {
    ctx = buildContext(input, timeoutMs);
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : "Geçersiz adres." };
    return;
  }

  const startedAt = new Date().toISOString();
  const start = Date.now();

  yield {
    type: "start",
    host: ctx.host,
    url: ctx.url,
    modules: MODULES.map((m) => m.id),
  };

  const results: ModuleResult[] = [];

  const pending = new Map(
    MODULES.map((m) => [
      m.id,
      m.run(ctx).catch(
        (err): ModuleResult => ({
          id: m.id,
          title: m.title,
          status: "error",
          score: 0,
          findings: [
            {
              title: "Modül çalıştırılamadı",
              severity: "info",
              detail: err instanceof Error ? err.message : String(err),
            },
          ],
        }),
      ),
    ]),
  );

  while (pending.size > 0) {
    const [id, result] = await Promise.race(
      Array.from(pending.entries()).map(async ([id, p]) => [id, await p] as const),
    );
    pending.delete(id);
    results.push(result);
    yield { type: "module", result };
  }

  results.sort((a, b) => MODULES.findIndex((m) => m.id === a.id) - MODULES.findIndex((m) => m.id === b.id));

  const overallScore = computeOverall(results);
  const report: ScanReport = {
    host: ctx.host,
    url: ctx.url,
    startedAt,
    durationMs: Date.now() - start,
    overallScore,
    grade: toGrade(overallScore),
    modules: results,
    summary: summarize(results),
  };

  yield { type: "done", report };
}
