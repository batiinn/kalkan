import type { ScanReport, Severity } from "@/scanner/types";

const SEV_TR: Record<Severity, string> = {
  critical: "KRİTİK",
  high: "YÜKSEK",
  medium: "ORTA",
  low: "DÜŞÜK",
  info: "BİLGİ",
  ok: "TAMAM",
};

export function PrintableReport({ report }: { report: ScanReport }) {
  const date = new Date(report.startedAt).toLocaleString("tr-TR");
  return (
    <div className="hidden print:block print-report">
      <div className="pr-header">
        <div>
          <div className="pr-brand">🛡 Kalkan Güvenlik Raporu</div>
          <div className="pr-host">{report.host}</div>
        </div>
        <div className="pr-score">
          <div className="pr-score-num">{report.overallScore}/100</div>
          <div className="pr-grade">{report.grade}</div>
        </div>
      </div>

      <div className="pr-summary">
        <span>{report.summary.critical} kritik</span>
        <span>{report.summary.high} yüksek</span>
        <span>{report.summary.medium} orta</span>
        <span>{report.summary.low} düşük</span>
        <span className="pr-date">Tarih: {date}</span>
      </div>

      {report.modules.map((m) => (
        <div key={m.id} className="pr-module">
          <div className="pr-module-title">
            {m.title} <span className="pr-module-score">{m.score}/100</span>
          </div>
          {m.findings.map((f, i) => (
            <div key={i} className="pr-finding">
              <span className="pr-sev">[{SEV_TR[f.severity]}]</span> <strong>{f.title}</strong>
              {f.detail && <div className="pr-detail">{f.detail}</div>}
              {f.remediation && <div className="pr-rem">→ {f.remediation}</div>}
            </div>
          ))}
        </div>
      ))}

      <div className="pr-footer">
        Kalkan ile oluşturuldu · açık kaynak web güvenlik tarayıcısı · yalnızca pasif analiz
      </div>
    </div>
  );
}
