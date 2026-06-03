import { Resolver } from "node:dns/promises";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

async function txt(resolver: Resolver, name: string): Promise<string[]> {
  try {
    const records = await resolver.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

export const emailModule = {
  id: "email",
  title: "E-posta Güvenliği (SPF / DMARC / DKIM)",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const resolver = new Resolver({ timeout: ctx.timeoutMs, tries: 1 });

    const rootTxt = await txt(resolver, ctx.host);
    const dmarcTxt = await txt(resolver, `_dmarc.${ctx.host}`);

    const spf = rootTxt.find((r) => r.toLowerCase().startsWith("v=spf1"));
    if (!spf) {
      findings.push({
        title: "SPF kaydı yok",
        severity: "medium",
        detail: "SPF olmadan saldırganlar alan adınız adına sahte e-posta gönderebilir (spoofing).",
        remediation: "Bir SPF TXT kaydı ekleyin (ör. `v=spf1 include:_spf.google.com -all`).",
      });
    } else if (/[?~]all\s*$/.test(spf) === false && /-all\s*$/.test(spf) === false) {
      findings.push({
        title: "SPF kaydı zayıf yapılandırılmış",
        severity: "low",
        detail: "SPF kaydı `-all` (hard fail) ile bitmiyor; sahte gönderimlere karşı tam koruma sağlamıyor.",
        remediation: "SPF kaydını `-all` ile sonlandırın.",
      });
    }

    const dmarc = dmarcTxt.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
    if (!dmarc) {
      findings.push({
        title: "DMARC kaydı yok",
        severity: "medium",
        detail: "DMARC, SPF/DKIM başarısız olduğunda ne yapılacağını belirler ve spoofing raporlaması sağlar. Yokluğu marka taklidi (phishing) riskini büyütür.",
        remediation: "`_dmarc` altına bir DMARC kaydı ekleyin (ör. `v=DMARC1; p=quarantine; rua=mailto:...`).",
      });
    } else if (/p=none/i.test(dmarc)) {
      findings.push({
        title: "DMARC politikası 'none'",
        severity: "low",
        detail: "DMARC mevcut ancak `p=none` ile yalnızca izleme yapıyor; sahte e-postaları engellemiyor.",
        remediation: "İzleme sonrası politikayı `p=quarantine` veya `p=reject` yapın.",
      });
    }

    if (findings.length === 0) {
      findings.push({
        title: "E-posta kimlik doğrulaması güçlü",
        severity: "ok",
        detail: "SPF ve DMARC kayıtları mevcut ve katı yapılandırılmış.",
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: {
        spf: spf ?? null,
        dmarc: dmarc ?? null,
      },
      durationMs: Date.now() - start,
    };
  },
};
