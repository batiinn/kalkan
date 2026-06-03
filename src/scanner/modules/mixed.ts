import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

export const mixedContentModule = {
  id: "mixed",
  title: "Karışık İçerik (Mixed Content)",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    if (ctx.protocol !== "https:") {
      findings.push({
        title: "Site HTTPS olmadığı için kontrol edilemedi",
        severity: "info",
        detail: "Karışık içerik yalnızca HTTPS sayfalarda anlamlıdır.",
      });
      return {
        id: this.id,
        title: this.title,
        status: "ok",
        score: 100,
        findings,
        durationMs: Date.now() - start,
      };
    }

    const res = await safeFetch(ctx.url, { timeoutMs: ctx.timeoutMs, maxBytes: 300 * 1024 });
    if (res.status === 0 || !res.body) {
      return {
        id: this.id,
        title: this.title,
        status: "error",
        score: 0,
        findings: [{ title: "Sayfa içeriği okunamadı", severity: "info" }],
        durationMs: Date.now() - start,
      };
    }

    const matches = res.body.match(/(?:src|href)\s*=\s*["']http:\/\/[^"']+["']/gi) ?? [];
    const insecure = Array.from(
      new Set(matches.map((m) => m.replace(/^[^"']*["']/, "").replace(/["'].*$/, ""))),
    ).filter((u) => !u.startsWith("http://localhost"));

    if (insecure.length > 0) {
      findings.push({
        title: `${insecure.length} adet şifresiz (HTTP) kaynak yükleniyor`,
        severity: "medium",
        detail: `HTTPS sayfa içinde HTTP üzerinden kaynak çağrılıyor; bu kaynaklar değiştirilebilir ve tarayıcı uyarısı/engellemesi oluşur. Örnek: ${insecure.slice(0, 3).join(", ")}`,
        remediation: "Tüm kaynak (script, stil, görsel, iframe) bağlantılarını HTTPS'e çevirin.",
      });
    } else {
      findings.push({
        title: "Karışık içerik yok",
        severity: "ok",
        detail: "Sayfadaki tüm kaynaklar güvenli (HTTPS) bağlantılarla yükleniyor.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { insecure: insecure.slice(0, 20) },
      durationMs: Date.now() - start,
    };
  },
};
