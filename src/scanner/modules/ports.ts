import net from "node:net";
import { deriveStatus, scoreFindings } from "../scoring";
import type { Finding, ModuleResult, ScanContext, Severity } from "../types";

interface PortInfo {
  port: number;
  service: string;
  risk: Severity;
  note: string;
}

const PORTS: PortInfo[] = [
  { port: 21, service: "FTP", risk: "medium", note: "Şifresiz dosya transferi; kimlik bilgileri açıkta gidebilir." },
  { port: 22, service: "SSH", risk: "low", note: "SSH internete açık; brute-force hedefi olabilir." },
  { port: 23, service: "Telnet", risk: "high", note: "Telnet tamamen şifresizdir ve asla internete açılmamalı." },
  { port: 25, service: "SMTP", risk: "low", note: "Açık SMTP; yanlış yapılandırılırsa spam relay olabilir." },
  { port: 3306, service: "MySQL", risk: "high", note: "Veritabanı doğrudan internete açık — kritik risk." },
  { port: 5432, service: "PostgreSQL", risk: "high", note: "Veritabanı doğrudan internete açık — kritik risk." },
  { port: 6379, service: "Redis", risk: "critical", note: "Redis genelde kimlik doğrulamasız; açıksa tam veri erişimi mümkün." },
  { port: 27017, service: "MongoDB", risk: "critical", note: "MongoDB açıkta — yetkisiz veri erişimi/sızıntısı riski." },
  { port: 3389, service: "RDP", risk: "high", note: "Uzak masaüstü açık; fidye yazılımı saldırılarının başlıca giriş noktası." },
  { port: 9200, service: "Elasticsearch", risk: "critical", note: "Açık Elasticsearch sık sık büyük veri sızıntılarına yol açar." },
  { port: 8080, service: "HTTP-alt", risk: "info", note: "Alternatif HTTP portu açık." },
];

function checkPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (open: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

export const portsModule = {
  id: "ports",
  title: "Açık Port Taraması",
  async run(ctx: ScanContext): Promise<ModuleResult> {
    const start = Date.now();
    const findings: Finding[] = [];
    const perPortTimeout = Math.min(ctx.timeoutMs, 3000);

    const results = await Promise.all(
      PORTS.map(async (p) => ({ info: p, open: await checkPort(ctx.host, p.port, perPortTimeout) })),
    );

    const open = results.filter((r) => r.open);

    for (const { info } of open) {
      if (info.risk === "info") {
        findings.push({
          title: `Port ${info.port} (${info.service}) açık`,
          severity: "info",
          detail: info.note,
        });
      } else {
        findings.push({
          title: `Port ${info.port} (${info.service}) internete açık`,
          severity: info.risk,
          detail: info.note,
          remediation: `${info.service} portunu güvenlik duvarıyla kapatın veya yalnızca güvenilir IP'lere/VPN'e açın.`,
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        title: "Riskli port tespit edilmedi",
        severity: "ok",
        detail: `${PORTS.length} yaygın hassas port (veritabanları, RDP, Telnet, FTP vb.) kontrol edildi; internete açık riskli servis bulunmadı.`,
      });
    }

    return {
      id: this.id,
      title: this.title,
      status: deriveStatus(findings),
      score: scoreFindings(findings),
      findings,
      meta: { openPorts: open.map((o) => `${o.info.port}/${o.info.service}`) },
      durationMs: Date.now() - start,
    };
  },
};
