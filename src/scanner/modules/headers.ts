import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext, Severity } from "../types";

interface HeaderCheck {
  name: string;
  label: string;
  severity: Severity;
  detail: string;
  remediation: string;
}

const CHECKS: HeaderCheck[] = [
  {
    name: "strict-transport-security",
    label: "HSTS (Strict-Transport-Security)",
    severity: "medium",
    detail: "Tarayıcıyı siteye yalnızca HTTPS üzerinden bağlanmaya zorlar; protokol düşürme saldırılarını engeller.",
    remediation: "`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` ekleyin.",
  },
  {
    name: "content-security-policy",
    label: "CSP (Content-Security-Policy)",
    severity: "medium",
    detail: "XSS ve veri enjeksiyonu saldırılarına karşı en etkili savunma katmanıdır.",
    remediation: "İçeriğinize uygun bir Content-Security-Policy tanımlayın (en azından `default-src 'self'`).",
  },
  {
    name: "x-frame-options",
    label: "X-Frame-Options",
    severity: "low",
    detail: "Sitenizin iframe içine alınıp tıklama hırsızlığı (clickjacking) için kullanılmasını engeller.",
    remediation: "`X-Frame-Options: SAMEORIGIN` ekleyin ya da CSP `frame-ancestors` kullanın.",
  },
  {
    name: "x-content-type-options",
    label: "X-Content-Type-Options",
    severity: "low",
    detail: "Tarayıcının MIME türü tahmin etmesini (MIME sniffing) engeller.",
    remediation: "`X-Content-Type-Options: nosniff` ekleyin.",
  },
  {
    name: "referrer-policy",
    label: "Referrer-Policy",
    severity: "low",
    detail: "Dış sitelere sızan referrer bilgisini kısıtlayarak gizliliği artırır.",
    remediation: "`Referrer-Policy: strict-origin-when-cross-origin` ekleyin.",
  },
  {
    name: "permissions-policy",
    label: "Permissions-Policy",
    severity: "low",
    detail: "Kamera, mikrofon, konum gibi tarayıcı özelliklerine erişimi kısıtlar.",
    remediation: "İhtiyaç duymadığınız özellikleri kapatan bir `Permissions-Policy` tanımlayın.",
  },
];

const LEAKY_HEADERS = ["server", "x-powered-by", "x-aspnet-version", "x-aspnetmvc-version"];

export const headersModule = {
  id: "headers",
  title: "Güvenlik Header'ları",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const res = await safeFetch(ctx.url, { timeoutMs: ctx.timeoutMs });

    if (res.error || res.status === 0) {
      return {
        id: this.id,
        title: this.title,
        status: "error",
        score: 0,
        findings: [
          {
            title: "Header'lar okunamadı",
            severity: "info",
            detail: `Siteye erişilemedi: ${res.error ?? "bilinmeyen hata"}`,
          },
        ],
        durationMs: Date.now() - start,
      };
    }

    const present: string[] = [];
    for (const check of CHECKS) {
      if (res.headers.has(check.name)) {
        present.push(check.label);
      } else {
        findings.push({
          title: `${check.label} eksik`,
          severity: check.severity,
          detail: check.detail,
          remediation: check.remediation,
        });
      }
    }

    const leaked: string[] = [];
    for (const h of LEAKY_HEADERS) {
      const val = res.headers.get(h);
      if (val) leaked.push(`${h}: ${val}`);
    }
    if (leaked.length > 0) {
      findings.push({
        title: "Sunucu bilgisi sızdırılıyor",
        severity: "low",
        detail: `Şu header'lar sürüm/teknoloji bilgisi açık ediyor: ${leaked.join(", ")}. Saldırganlar bilinen açıkları hedeflemek için kullanır.`,
        remediation: "`Server` ve `X-Powered-By` gibi header'ları gizleyin veya kaldırın.",
      });
    }

    if (present.length > 0) {
      findings.push({
        title: `${present.length} güvenlik header'ı mevcut`,
        severity: "ok",
        detail: present.join(", "),
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { present, leaked },
      durationMs: Date.now() - start,
    };
  },
};
