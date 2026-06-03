import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

interface Signature {
  name: string;
  header?: { key: string; match?: RegExp };
  body?: RegExp;
  version?: RegExp;
}

const SIGNATURES: Signature[] = [
  { name: "WordPress", body: /wp-content|wp-includes|<meta name="generator" content="WordPress/i, version: /WordPress (\d+\.\d+(\.\d+)?)/i },
  { name: "Drupal", body: /Drupal\.settings|sites\/all|<meta name="Generator" content="Drupal/i },
  { name: "Joomla", body: /\/media\/jui\/|Joomla!/i },
  { name: "Nginx", header: { key: "server", match: /nginx/i }, version: /nginx\/(\d+\.\d+\.\d+)/i },
  { name: "Apache", header: { key: "server", match: /apache/i }, version: /Apache\/(\d+\.\d+\.\d+)/i },
  { name: "PHP", header: { key: "x-powered-by", match: /php/i }, version: /PHP\/(\d+\.\d+\.\d+)/i },
  { name: "ASP.NET", header: { key: "x-powered-by", match: /asp\.net/i } },
  { name: "Cloudflare", header: { key: "server", match: /cloudflare/i } },
  { name: "Next.js", header: { key: "x-powered-by", match: /next\.js/i }, body: /\/_next\/static/ },
  { name: "React", body: /id="root"|data-reactroot|__NEXT_DATA__/ },
  { name: "Vue.js", body: /data-v-[0-9a-f]{8}|__VUE__/ },
  { name: "jQuery", body: /jquery[.-]/i, version: /jquery[.-](\d+\.\d+\.\d+)/i },
];

export const techModule = {
  id: "tech",
  title: "Teknoloji Parmak İzi",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const res = await safeFetch(ctx.url, { timeoutMs: ctx.timeoutMs, maxBytes: 200 * 1024 });

    const detected: { name: string; version?: string }[] = [];

    for (const sig of SIGNATURES) {
      let hit = false;
      let source = "";

      if (sig.header) {
        const val = res.headers.get(sig.header.key);
        if (val && (!sig.header.match || sig.header.match.test(val))) {
          hit = true;
          source = val;
        }
      }
      if (!hit && sig.body && res.body && sig.body.test(res.body)) {
        hit = true;
        source = res.body;
      }

      if (hit) {
        let version: string | undefined;
        if (sig.version) {
          const m = source.match(sig.version) ?? res.body.match(sig.version);
          if (m) version = m[1];
        }
        detected.push({ name: sig.name, version });
      }
    }

    if (detected.length > 0) {
      const withVersion = detected.filter((d) => d.version);
      if (withVersion.length > 0) {
        findings.push({
          title: "Açık sürüm bilgisi tespit edildi",
          severity: "low",
          detail: `Şu teknolojilerin sürümleri dışarıdan görülebiliyor: ${withVersion
            .map((d) => `${d.name} ${d.version}`)
            .join(", ")}. Saldırganlar bu sürümlere ait bilinen açıkları (CVE) hedefleyebilir.`,
          remediation: "Yazılımları güncel tutun ve mümkünse sürüm bilgisini gizleyin.",
        });
      }
      findings.push({
        title: `${detected.length} teknoloji tespit edildi`,
        severity: "ok",
        detail: detected.map((d) => (d.version ? `${d.name} ${d.version}` : d.name)).join(", "),
      });
    } else {
      findings.push({
        title: "Belirgin teknoloji parmak izi yok",
        severity: "ok",
        detail: "Yaygın CMS/sunucu imzaları dışarıdan kolayca tespit edilemedi — bu olumlu bir durumdur.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { detected },
      durationMs: Date.now() - start,
    };
  },
};
