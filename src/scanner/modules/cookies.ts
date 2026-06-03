import { safeFetch } from "../http";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

function getSetCookies(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}

export const cookiesModule = {
  id: "cookies",
  title: "Çerez Güvenliği",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const res = await safeFetch(ctx.url, { timeoutMs: ctx.timeoutMs });
    const cookies = getSetCookies(res.headers);

    if (cookies.length === 0) {
      findings.push({
        title: "İlk yanıtta çerez ayarlanmıyor",
        severity: "ok",
        detail: "Ana sayfa yüklenirken Set-Cookie başlığı görülmedi (oturum çerezleri giriş sonrası ayarlanıyor olabilir).",
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

    let insecure = 0;
    let noHttpOnly = 0;
    let noSameSite = 0;
    const names: string[] = [];

    for (const c of cookies) {
      const name = c.split("=")[0]?.trim() ?? "(isimsiz)";
      names.push(name);
      const lower = c.toLowerCase();
      if (ctx.protocol === "https:" && !lower.includes("secure")) insecure++;
      if (!lower.includes("httponly")) noHttpOnly++;
      if (!lower.includes("samesite")) noSameSite++;
    }

    if (insecure > 0) {
      findings.push({
        title: `${insecure} çerezde 'Secure' bayrağı yok`,
        severity: "medium",
        detail: "Secure işareti olmayan çerezler şifresiz HTTP üzerinden de gönderilir ve ele geçirilebilir.",
        remediation: "Tüm çerezlere `Secure` bayrağı ekleyin.",
      });
    }
    if (noHttpOnly > 0) {
      findings.push({
        title: `${noHttpOnly} çerezde 'HttpOnly' bayrağı yok`,
        severity: "medium",
        detail: "HttpOnly olmayan çerezlere JavaScript erişebilir; XSS ile oturum çalınabilir.",
        remediation: "Oturum çerezlerine `HttpOnly` bayrağı ekleyin.",
      });
    }
    if (noSameSite > 0) {
      findings.push({
        title: `${noSameSite} çerezde 'SameSite' özniteliği yok`,
        severity: "low",
        detail: "SameSite olmadan çerezler CSRF saldırılarına daha açık olur.",
        remediation: "Çerezlere `SameSite=Lax` veya `SameSite=Strict` ekleyin.",
      });
    }

    if (findings.length === 0) {
      findings.push({
        title: "Çerezler güvenli yapılandırılmış",
        severity: "ok",
        detail: `${cookies.length} çerezin tümünde Secure, HttpOnly ve SameSite mevcut.`,
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { cookieNames: names },
      durationMs: Date.now() - start,
    };
  },
};
