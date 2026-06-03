import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext, Severity } from "../types";

interface PathProbe {
  path: string;
  label: string;
  severity: Severity;
  confirm?: (body: string, contentType: string) => boolean;
  detail: string;
}

const PROBES: PathProbe[] = [
  {
    path: "/.env",
    label: ".env ortam değişkenleri dosyası",
    severity: "critical",
    confirm: (b) => /^[A-Z0-9_]+=/m.test(b) || /(DB_|APP_|SECRET|API_KEY|PASSWORD)/i.test(b),
    detail: "Veritabanı şifreleri ve API anahtarları gibi tüm gizli bilgiler herkese açık.",
  },
  {
    path: "/.git/config",
    label: ".git deposu açıkta",
    severity: "critical",
    confirm: (b) => b.includes("[core]") || b.includes("[remote"),
    detail: "Tüm kaynak kodunuz ve geçmişiniz indirilebilir; gömülü sırlar sızabilir.",
  },
  {
    path: "/.git/HEAD",
    label: ".git/HEAD erişilebilir",
    severity: "critical",
    confirm: (b) => b.trim().startsWith("ref:"),
    detail: "Git deposu dışarıdan klonlanabilir durumda.",
  },
  {
    path: "/wp-config.php.bak",
    label: "WordPress yapılandırma yedeği",
    severity: "critical",
    confirm: (b) => b.includes("DB_PASSWORD") || b.includes("DB_NAME"),
    detail: "WordPress veritabanı kimlik bilgileri açıkta.",
  },
  {
    path: "/.DS_Store",
    label: ".DS_Store dosyası",
    severity: "low",
    confirm: (b) => b.includes("Bud1") || b.length > 0,
    detail: "Dizin yapınız hakkında bilgi sızdırır.",
  },
  {
    path: "/phpinfo.php",
    label: "phpinfo() sayfası açık",
    severity: "high",
    confirm: (b) => b.includes("PHP Version") || b.includes("phpinfo()"),
    detail: "Sunucu yapılandırması, yollar ve modüller hakkında ayrıntılı bilgi sızdırır.",
  },
  {
    path: "/.env.backup",
    label: ".env yedek dosyası",
    severity: "critical",
    confirm: (b) => /^[A-Z0-9_]+=/m.test(b),
    detail: "Gizli ortam değişkenlerinin yedeği açıkta.",
  },
  {
    path: "/server-status",
    label: "Apache server-status",
    severity: "medium",
    confirm: (b) => b.includes("Apache Server Status"),
    detail: "Aktif istekler ve sunucu içgörüsü dışarıya açık.",
  },
  {
    path: "/.well-known/security.txt",
    label: "security.txt (iyi uygulama)",
    severity: "ok",
    confirm: (b) => /contact:/i.test(b),
    detail: "Güvenlik araştırmacılarının size ulaşabilmesi için iletişim bilgisi yayınlanmış.",
  },
];

export const exposedModule = {
  id: "exposed",
  title: "Açıkta Kalan Hassas Dosyalar",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const checked: string[] = [];

    const results = await Promise.all(
      PROBES.map(async (probe) => {
        const res = await safeFetch(`${ctx.url}${probe.path}`, {
          timeoutMs: ctx.timeoutMs,
          maxBytes: 16 * 1024,
        });
        return { probe, res };
      }),
    );

    for (const { probe, res } of results) {
      checked.push(probe.path);
      if (res.status !== 200) continue;
      const contentType = res.headers.get("content-type") ?? "";
      const confirmed = probe.confirm ? probe.confirm(res.body, contentType) : true;
      if (!confirmed) continue;

      if (probe.severity === "ok") {
        findings.push({
          title: probe.label,
          severity: "ok",
          detail: probe.detail,
        });
      } else {
        findings.push({
          title: `${probe.label} (${probe.path})`,
          severity: probe.severity,
          detail: probe.detail,
          remediation: `Bu yolu (${probe.path}) sunucu yapılandırmasıyla erişime kapatın veya kaldırın.`,
        });
      }
    }

    const hasRisk = findings.some((f) => f.severity !== "ok");
    if (!hasRisk) {
      findings.push({
        title: "Yaygın hassas dosyaların hiçbiri açıkta değil",
        severity: "ok",
        detail: `${checked.length} kritik yol kontrol edildi (.env, .git, yedekler, phpinfo vb.); erişilebilir bir tehdit bulunamadı.`,
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { checkedPaths: checked },
      durationMs: Date.now() - start,
    };
  },
};
