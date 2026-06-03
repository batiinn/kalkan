import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

const SENSITIVE_PREFIXES = [
  "admin",
  "test",
  "dev",
  "staging",
  "stage",
  "uat",
  "demo",
  "backup",
  "old",
  "beta",
  "internal",
  "vpn",
  "db",
  "phpmyadmin",
  "jenkins",
  "git",
];

export const subdomainsModule = {
  id: "subdomains",
  title: "Subdomain Keşfi",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    const apex = ctx.host.replace(/^www\./, "");
    const res = await safeFetch(
      `https://crt.sh/?q=${encodeURIComponent("%." + apex)}&output=json`,
      { timeoutMs: Math.max(ctx.timeoutMs, 10000), maxBytes: 2 * 1024 * 1024 },
    );

    const subdomains = new Set<string>();
    if (res.status === 200 && res.body) {
      try {
        const entries = JSON.parse(res.body) as { name_value: string }[];
        for (const e of entries) {
          for (const name of e.name_value.split("\n")) {
            const clean = name.trim().toLowerCase().replace(/^\*\./, "");
            if (clean.endsWith(apex) && clean !== apex) {
              subdomains.add(clean);
            }
          }
        }
      } catch {
      }
    }

    const list = Array.from(subdomains).sort();
    const sensitive = list.filter((s) => {
      const label = s.replace(`.${apex}`, "").split(".").pop() ?? "";
      return SENSITIVE_PREFIXES.some((p) => label === p || label.startsWith(p));
    });

    if (res.status !== 200) {
      findings.push({
        title: "Subdomain kaynağına ulaşılamadı",
        severity: "info",
        detail: "Sertifika şeffaflık günlükleri (crt.sh) şu an yanıt vermedi; keşif atlandı.",
      });
    } else if (sensitive.length > 0) {
      findings.push({
        title: `${sensitive.length} hassas subdomain tespit edildi`,
        severity: "medium",
        detail: `Saldırı yüzeyini büyüten ortamlar açıkta olabilir: ${sensitive.slice(0, 10).join(", ")}`,
        remediation: "Test/dev/staging gibi ortamları internete kapatın veya kimlik doğrulamayla koruyun.",
      });
    }

    if (list.length > 0 && sensitive.length === 0) {
      findings.push({
        title: `${list.length} subdomain bulundu (riskli isim yok)`,
        severity: "ok",
        detail: "Sertifika günlüklerinde görülen subdomain'ler arasında açıkça riskli (admin/test/dev) bir isim yok.",
      });
    } else if (list.length === 0 && res.status === 200) {
      findings.push({
        title: "Genel subdomain bulunamadı",
        severity: "ok",
        detail: "Sertifika şeffaflık günlüklerinde ek subdomain görülmedi.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { total: list.length, subdomains: list.slice(0, 50), sensitive },
      durationMs: Date.now() - start,
    };
  },
};
