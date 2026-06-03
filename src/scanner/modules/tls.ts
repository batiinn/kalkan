import tls from "node:tls";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext } from "../types";

interface CertInfo {
  valid: boolean;
  daysRemaining: number | null;
  issuer: string;
  subject: string;
  validFrom: string;
  validTo: string;
  protocol: string | null;
  altNames: string;
  selfSigned: boolean;
}

function getCertificate(host: string, timeoutMs: number): Promise<CertInfo | { error: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate(true);
        const protocol = socket.getProtocol();
        const authorized = socket.authorized;

        if (!cert || Object.keys(cert).length === 0) {
          socket.destroy();
          resolve({ error: "Sertifika alınamadı." });
          return;
        }

        const validTo = new Date(cert.valid_to);
        const daysRemaining = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
        const issuer = cert.issuer?.O ?? cert.issuer?.CN ?? "Bilinmiyor";
        const subject = cert.subject?.CN ?? host;
        const selfSigned = cert.issuer?.CN === cert.subject?.CN && !authorized;

        socket.destroy();
        resolve({
          valid: authorized,
          daysRemaining,
          issuer,
          subject,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          protocol,
          altNames: cert.subjectaltname ?? "",
          selfSigned,
        });
      },
    );

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ error: err.message });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ error: "Bağlantı zaman aşımına uğradı." });
    });
  });
}

export const tlsModule = {
  id: "tls",
  title: "SSL/TLS Sertifikası",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];

    if (ctx.protocol !== "https:") {
      findings.push({
        title: "Site HTTPS kullanmıyor",
        severity: "high",
        detail: "Site şifresiz HTTP üzerinden sunuluyor. Tüm trafik araya girme (MITM) saldırılarına açık.",
        remediation: "Geçerli bir SSL sertifikası kurun (Let's Encrypt ücretsizdir) ve tüm trafiği HTTPS'e yönlendirin.",
      });
      return {
        id: this.id,
        title: this.title,
        status: "fail",
        score: scoreFindings(findings),
        findings,
        durationMs: Date.now() - start,
      };
    }

    const result = await getCertificate(ctx.host, ctx.timeoutMs);

    if ("error" in result) {
      findings.push({
        title: "SSL sertifikası doğrulanamadı",
        severity: "high",
        detail: `Sertifikaya erişilirken hata: ${result.error}`,
        remediation: "Sunucunun 443 portunda geçerli bir sertifika sunduğundan emin olun.",
      });
      return {
        id: this.id,
        title: this.title,
        status: "fail",
        score: scoreFindings(findings),
        findings,
        durationMs: Date.now() - start,
      };
    }

    if (!result.valid) {
      findings.push({
        title: result.selfSigned ? "Kendinden imzalı (self-signed) sertifika" : "Sertifika güvenilir değil",
        severity: "high",
        detail: "Tarayıcılar bu sertifikaya güvenmez; ziyaretçiler güvenlik uyarısı görür.",
        remediation: "Tanınmış bir sertifika otoritesinden (ör. Let's Encrypt) sertifika alın.",
      });
    }

    if (result.daysRemaining !== null) {
      if (result.daysRemaining < 0) {
        findings.push({
          title: "Sertifikanın süresi dolmuş",
          severity: "critical",
          detail: `Sertifika ${Math.abs(result.daysRemaining)} gün önce sona ermiş.`,
          remediation: "Sertifikayı acilen yenileyin.",
        });
      } else if (result.daysRemaining < 14) {
        findings.push({
          title: "Sertifika çok yakında sona eriyor",
          severity: "medium",
          detail: `Sertifikanın bitmesine ${result.daysRemaining} gün kaldı.`,
          remediation: "Otomatik yenileme kurun (certbot vb.) ya da sertifikayı yenileyin.",
        });
      } else if (result.daysRemaining < 30) {
        findings.push({
          title: "Sertifika 30 günden az süre içinde sona eriyor",
          severity: "low",
          detail: `Sertifikanın bitmesine ${result.daysRemaining} gün kaldı.`,
          remediation: "Yenileme planınızı kontrol edin.",
        });
      }
    }

    if (result.protocol && /TLSv1(\.0|\.1)?$/.test(result.protocol)) {
      findings.push({
        title: `Eski TLS sürümü: ${result.protocol}`,
        severity: "medium",
        detail: "TLS 1.0/1.1 güvensiz kabul edilir ve modern tarayıcılarca terk edilmiştir.",
        remediation: "Sunucuda yalnızca TLS 1.2 ve 1.3 sürümlerini etkinleştirin.",
      });
    }

    if (findings.length === 0) {
      findings.push({
        title: "Geçerli ve güçlü SSL/TLS yapılandırması",
        severity: "ok",
        detail: `${result.issuer} tarafından verilmiş, ${result.daysRemaining} gün geçerli (${result.protocol}).`,
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: {
        issuer: result.issuer,
        subject: result.subject,
        validFrom: result.validFrom,
        validTo: result.validTo,
        protocol: result.protocol,
        daysRemaining: result.daysRemaining,
      },
      durationMs: Date.now() - start,
    };
  },
};
