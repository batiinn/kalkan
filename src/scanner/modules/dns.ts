import { Resolver } from "node:dns/promises";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export const dnsModule = {
  id: "dns",
  title: "DNS Yapılandırması",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const resolver = new Resolver({ timeout: ctx.timeoutMs, tries: 1 });

    const [a, aaaa, mx, ns, caa, txt] = await Promise.all([
      withTimeout(resolver.resolve4(ctx.host).catch(() => []), ctx.timeoutMs, [] as string[]),
      withTimeout(resolver.resolve6(ctx.host).catch(() => []), ctx.timeoutMs, [] as string[]),
      withTimeout(resolver.resolveMx(ctx.host).catch(() => []), ctx.timeoutMs, [] as { exchange: string; priority: number }[]),
      withTimeout(resolver.resolveNs(ctx.host).catch(() => []), ctx.timeoutMs, [] as string[]),
      withTimeout(resolver.resolveCaa(ctx.host).catch(() => []), ctx.timeoutMs, [] as unknown[]),
      withTimeout(resolver.resolveTxt(ctx.host).catch(() => []), ctx.timeoutMs, [] as string[][]),
    ]);

    if (a.length === 0 && aaaa.length === 0) {
      findings.push({
        title: "A/AAAA kaydı bulunamadı",
        severity: "info",
        detail: "Alan adı için IP kaydı çözümlenemedi.",
      });
    }

    if (caa.length === 0) {
      findings.push({
        title: "CAA kaydı yok",
        severity: "low",
        detail: "CAA kaydı, alan adınız için hangi sertifika otoritelerinin sertifika üretebileceğini sınırlar. Yokluğu yetkisiz sertifika üretimi riskini artırır.",
        remediation: "DNS'e bir CAA kaydı ekleyin (ör. `0 issue \"letsencrypt.org\"`).",
      });
    }

    if (ns.length < 2) {
      findings.push({
        title: "Yetersiz isim sunucusu (NS)",
        severity: "low",
        detail: "Tek NS kaydı tek hata noktası oluşturur; DNS kesintisi sitenizi tamamen erişilemez yapabilir.",
        remediation: "En az iki farklı isim sunucusu kullanın.",
      });
    }

    if (findings.length === 0) {
      findings.push({
        title: "DNS yapılandırması sağlıklı",
        severity: "ok",
        detail: `${a.length} A, ${ns.length} NS, ${mx.length} MX, CAA mevcut.`,
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: {
        a,
        aaaa,
        mx: mx.map((m) => `${m.exchange} (öncelik ${m.priority})`),
        ns,
        caa: caa.length,
        txtCount: txt.length,
      },
      durationMs: Date.now() - start,
    };
  },
};
