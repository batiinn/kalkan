import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

const EVIL_ORIGIN = "https://kalkan-cors-test.example";

export const corsModule = {
  id: "cors",
  title: "CORS Yapılandırması",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ctx.timeoutMs);
    let acao = "";
    let acac = "";
    let reachable = false;

    try {
      const res = await fetch(ctx.url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          Origin: EVIL_ORIGIN,
          "User-Agent": "Kalkan-Security-Scanner/0.1",
        },
      });
      reachable = true;
      acao = res.headers.get("access-control-allow-origin") ?? "";
      acac = res.headers.get("access-control-allow-credentials") ?? "";
      try {
        await res.body?.cancel();
      } catch {
      }
    } catch {
      reachable = false;
    } finally {
      clearTimeout(timer);
    }

    if (!reachable) {
      return {
        id: this.id,
        title: this.title,
        status: "error",
        score: 0,
        findings: [{ title: "CORS başlıkları okunamadı", severity: "info" }],
        durationMs: Date.now() - start,
      };
    }

    const reflectsEvil = acao === EVIL_ORIGIN;
    const wildcard = acao === "*";
    const credentials = acac.toLowerCase() === "true";

    if (reflectsEvil && credentials) {
      findings.push({
        title: "Tehlikeli CORS: keyfi origin + kimlik bilgisi",
        severity: "high",
        detail: "Sunucu, gönderdiğimiz sahte origin'i yansıtıyor ve `Allow-Credentials: true` döndürüyor. Bu, başka sitelerin kullanıcı oturumuyla veri çekmesine izin verebilir.",
        remediation: "Access-Control-Allow-Origin için katı bir izin listesi kullanın; kimlik bilgisiyle birlikte origin yansıtmayın.",
      });
    } else if (reflectsEvil) {
      findings.push({
        title: "CORS keyfi origin'i yansıtıyor",
        severity: "medium",
        detail: "Sunucu gönderilen herhangi bir origin'i kabul ediyor. Kimlik bilgisi olmadan riski düşük olsa da gereksiz açıklıktır.",
        remediation: "Yalnızca güvendiğiniz origin'lere izin verin.",
      });
    } else if (wildcard && credentials) {
      findings.push({
        title: "CORS yanlış yapılandırması (`*` + credentials)",
        severity: "medium",
        detail: "Joker (`*`) origin ile kimlik bilgisi birlikte kullanılıyor (tarayıcılar genelde reddeder ama yapılandırma hatalıdır).",
        remediation: "Joker origin yerine açık origin listesi tanımlayın.",
      });
    } else {
      findings.push({
        title: "CORS yapılandırması güvenli",
        severity: "ok",
        detail: acao ? `Access-Control-Allow-Origin: ${acao}` : "Sahte origin yansıtılmadı; çapraz-origin erişimi kısıtlı.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { acao, acac },
      durationMs: Date.now() - start,
    };
  },
};
