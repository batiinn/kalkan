import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

export const redirectModule = {
  id: "redirect",
  title: "HTTPS Yönlendirmesi",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const httpUrl = `http://${ctx.host}`;

    const res = await safeFetch(httpUrl, {
      timeoutMs: ctx.timeoutMs,
      redirect: "manual",
    });

    if (res.error || res.status === 0) {
      findings.push({
        title: "HTTP (port 80) yanıt vermiyor",
        severity: "ok",
        detail: "Şifresiz HTTP portu kapalı görünüyor; bu güvenli bir durumdur.",
      });
    } else if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") ?? "";
      if (location.startsWith("https://")) {
        findings.push({
          title: "HTTP otomatik olarak HTTPS'e yönlendiriliyor",
          severity: "ok",
          detail: `HTTP isteği ${res.status} ile ${location} adresine yönlendiriliyor.`,
        });
      } else {
        findings.push({
          title: "Yönlendirme HTTPS'e gitmiyor",
          severity: "medium",
          detail: `HTTP isteği şuraya yönlendiriliyor: ${location || "(belirsiz)"} — HTTPS'e değil.`,
          remediation: "HTTP trafiğini 301 ile sitenin HTTPS sürümüne yönlendirin.",
        });
      }
    } else if (res.status === 200) {
      findings.push({
        title: "Site şifresiz HTTP üzerinden de servis ediliyor",
        severity: "high",
        detail: "HTTP isteği HTTPS'e yönlendirilmeden 200 OK döndü. Ziyaretçiler şifresiz bağlantıda kalabilir.",
        remediation: "Tüm HTTP trafiğini kalıcı (301) olarak HTTPS'e yönlendirin.",
      });
    } else {
      findings.push({
        title: `HTTP beklenmedik durum kodu döndürdü: ${res.status}`,
        severity: "low",
        detail: "HTTP→HTTPS yönlendirmesi net değil.",
        remediation: "HTTP isteklerinin 301 ile HTTPS'e gittiğinden emin olun.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      durationMs: Date.now() - start,
    };
  },
};
