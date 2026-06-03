import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

export const wordpressModule = {
  id: "wordpress",
  title: "WordPress Güvenliği",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    const [users, xmlrpc, readme, login] = await Promise.all([
      safeFetch(`${ctx.url}/wp-json/wp/v2/users`, { timeoutMs: ctx.timeoutMs, maxBytes: 32 * 1024 }),
      safeFetch(`${ctx.url}/xmlrpc.php`, { timeoutMs: ctx.timeoutMs, maxBytes: 4 * 1024 }),
      safeFetch(`${ctx.url}/readme.html`, { timeoutMs: ctx.timeoutMs, maxBytes: 16 * 1024 }),
      safeFetch(`${ctx.url}/wp-login.php`, { timeoutMs: ctx.timeoutMs, redirect: "manual", maxBytes: 8 * 1024 }),
    ]);

    const isWordPress =
      (login.status > 0 && login.status !== 404) ||
      xmlrpc.body.includes("XML-RPC") ||
      readme.body.includes("WordPress") ||
      users.headers.get("content-type")?.includes("json") === true;

    if (!isWordPress) {
      findings.push({
        title: "WordPress tespit edilmedi",
        severity: "ok",
        detail: "Site WordPress kullanmıyor görünüyor; WordPress'e özgü kontroller atlandı.",
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

    if (users.status === 200 && users.headers.get("content-type")?.includes("json")) {
      try {
        const arr = JSON.parse(users.body) as { slug?: string; name?: string }[];
        const names = arr.map((u) => u.slug ?? u.name).filter(Boolean);
        if (names.length > 0) {
          findings.push({
            title: "Kullanıcı adları dışarıdan listelenebiliyor",
            severity: "high",
            detail: `WordPress REST API (/wp-json/wp/v2/users) ${names.length} kullanıcı adını açık ediyor: ${names.slice(0, 5).join(", ")}. Bu, brute-force giriş saldırılarını kolaylaştırır.`,
            remediation: "REST API kullanıcı uç noktasını kapatın (ör. bir güvenlik eklentisi veya `rest_endpoints` filtresiyle).",
          });
        }
      } catch {
      }
    }

    if (xmlrpc.status === 200 || xmlrpc.status === 405 || xmlrpc.body.includes("XML-RPC server accepts POST")) {
      findings.push({
        title: "XML-RPC etkin (xmlrpc.php)",
        severity: "medium",
        detail: "Açık XML-RPC, kimlik bilgisi brute-force ve pingback tabanlı DDoS amplifikasyonu için kötüye kullanılabilir.",
        remediation: "Kullanmıyorsanız xmlrpc.php erişimini sunucu düzeyinde engelleyin.",
      });
    }

    if (readme.status === 200) {
      const m = readme.body.match(/Version\s+(\d+\.\d+(\.\d+)?)/i);
      findings.push({
        title: m ? `WordPress sürümü ifşa ediliyor: ${m[1]}` : "readme.html erişilebilir",
        severity: "low",
        detail: "readme.html dosyası WordPress sürümünü açık eder; saldırganlar o sürüme ait bilinen açıkları hedefleyebilir.",
        remediation: "readme.html dosyasını silin veya erişime kapatın.",
      });
    }

    if (login.status === 200) {
      findings.push({
        title: "wp-login.php herkese açık",
        severity: "low",
        detail: "Yönetici giriş sayfası ek koruma olmadan erişilebilir; otomatik brute-force denemelerine hedef olur.",
        remediation: "Giriş sayfasını IP kısıtlaması, 2FA veya giriş deneme limitiyle koruyun.",
      });
    }

    if (findings.length === 0) {
      findings.push({
        title: "WordPress tespit edildi, belirgin zafiyet yok",
        severity: "ok",
        detail: "Yaygın WordPress sızıntıları (kullanıcı listeleme, XML-RPC, sürüm ifşası) kontrol edildi; risk bulunmadı.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { isWordPress },
      durationMs: Date.now() - start,
    };
  },
};
