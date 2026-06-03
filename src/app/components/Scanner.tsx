"use client";

import { useEffect, useRef, useState } from "react";
import type { ModuleResult, ScanEvent, ScanReport } from "@/scanner/types";
import { ModuleCard } from "./ModuleCard";
import { PrintableReport } from "./PrintableReport";
import { ScoreGauge } from "./ScoreGauge";
import { SearchIcon, ShieldIcon } from "./icons";

type Phase = "idle" | "scanning" | "done" | "error";

const MODULE_LABELS: Record<string, string> = {
  tls: "SSL/TLS",
  redirect: "HTTPS yönlendirme",
  headers: "Güvenlik header'ları",
  cookies: "Çerez güvenliği",
  exposed: "Açıkta kalan dosyalar",
  ports: "Açık port taraması",
  email: "E-posta (SPF/DMARC)",
  cors: "CORS yapılandırması",
  mixed: "Karışık içerik",
  wordpress: "WordPress güvenliği",
  dns: "DNS",
  subdomains: "Subdomain keşfi",
  tech: "Teknoloji parmak izi",
};

export function Scanner() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [host, setHost] = useState("");
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [modules, setModules] = useState<ModuleResult[]>([]);
  const [report, setReport] = useState<ScanReport | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("url");
    if (initial) {
      startedRef.current = true;
      setInput(initial);
      void runScan(undefined, initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runScan(e?: React.FormEvent, explicitTarget?: string) {
    e?.preventDefault();
    const target = (explicitTarget ?? input).trim();
    if (!target || phase === "scanning") return;

    try {
      const u = new URL(window.location.href);
      u.searchParams.set("url", target);
      window.history.replaceState(null, "", u.toString());
    } catch {
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setPhase("scanning");
    setError("");
    setModules([]);
    setReport(null);
    setHost("");
    setPendingIds([]);

    try {
      const res = await fetch(`/api/scan?url=${encodeURIComponent(target)}`, { signal: ctrl.signal });
      if (!res.body) throw new Error("Yanıt akışı alınamadı.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ScanEvent;
          handleEvent(event);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Tarama başarısız oldu.");
      setPhase("error");
    }
  }

  function handleEvent(event: ScanEvent) {
    if (event.type === "start") {
      setHost(event.host);
      setPendingIds(event.modules);
    } else if (event.type === "module") {
      setModules((prev) => [...prev, event.result]);
      setPendingIds((prev) => prev.filter((id) => id !== event.result.id));
    } else if (event.type === "done") {
      setReport(event.report);
      setModules(event.report.modules);
      setPhase("done");
    } else if (event.type === "error") {
      setError(event.message);
      setPhase("error");
    }
  }

  const sortedModules = report
    ? report.modules
    : [...modules].sort((a, b) => {
        const rank = { fail: 0, warn: 1, error: 2, ok: 3 } as const;
        return rank[a.status] - rank[b.status];
      });

  return (
    <div className="w-full">
      <form onSubmit={runScan} className="mx-auto flex max-w-2xl flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--color-ink-faint)]" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ornek.com"
            spellCheck={false}
            autoCapitalize="off"
            className="mono w-full rounded-xl border border-[color:var(--color-border-bright)] bg-[color:var(--color-surface)] py-4 pl-12 pr-4 text-[15px] text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-faint)] focus:border-[color:var(--color-accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={phase === "scanning" || !input.trim()}
          className="flex items-center justify-center gap-2 rounded-xl bg-[color:var(--color-accent)] px-7 py-4 font-semibold text-[#04201c] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "scanning" ? (
            <>
              <span className="spin-slow inline-block h-4 w-4 rounded-full border-2 border-[#04201c] border-t-transparent" />
              Taranıyor
            </>
          ) : (
            <>
              <ShieldIcon className="h-5 w-5" />
              Ücretsiz Tara
            </>
          )}
        </button>
      </form>

      {phase === "error" && (
        <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-[color:var(--color-crit)]/40 bg-[color:var(--color-crit)]/5 px-4 py-3 text-center text-sm text-[color:var(--color-high)]">
          {error}
        </div>
      )}

      {(phase === "scanning" || phase === "done") && (
        <div className="mx-auto mt-12 max-w-3xl print:hidden">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 sm:flex-row sm:items-center sm:gap-10">
            <div className="relative shrink-0">
              {!report && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="spin-slow h-14 w-14 rounded-full border-2 border-[color:var(--color-accent)] border-t-transparent" />
                </div>
              )}
              {report && <ScoreGauge score={report.overallScore} grade={report.grade} />}
              {!report && <div style={{ width: 200, height: 200 }} />}
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="mono text-sm text-[color:var(--color-ink-dim)]">{host || "hazırlanıyor…"}</div>
              <div className="mt-1 text-2xl font-bold">
                {report ? "Tarama tamamlandı" : "Güvenlik taranıyor…"}
              </div>
              {report ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <Stat n={report.summary.critical} label="kritik" color="var(--color-crit)" />
                  <Stat n={report.summary.high} label="yüksek" color="var(--color-high)" />
                  <Stat n={report.summary.medium} label="orta" color="var(--color-med)" />
                  <Stat n={report.summary.low} label="düşük" color="var(--color-low)" />
                </div>
              ) : (
                <div className="mt-3 text-sm text-[color:var(--color-ink-dim)]">
                  {modules.length}/{modules.length + pendingIds.length} modül tamamlandı
                </div>
              )}
            </div>
          </div>

          {pendingIds.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {pendingIds.map((id) => (
                <span
                  key={id}
                  className="mono flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs text-[color:var(--color-ink-dim)]"
                >
                  <span className="spin-slow inline-block h-3 w-3 rounded-full border border-[color:var(--color-accent)] border-t-transparent" />
                  {MODULE_LABELS[id] ?? id}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-2.5">
            {sortedModules.map((m, i) => (
              <ModuleCard key={m.id} module={m} index={i} />
            ))}
          </div>

          {report && <ShareActions report={report} />}

          {report && (
            <p className="mono mt-6 text-center text-xs text-[color:var(--color-ink-faint)]">
              {report.durationMs} ms içinde tarandı · pasif analiz, hedefe zarar vermez
            </p>
          )}
        </div>
      )}

      {report && <PrintableReport report={report} />}
    </div>
  );
}

function ShareActions({ report }: { report: ScanReport }) {
  const [copied, setCopied] = useState<string>("");
  const [showEmbed, setShowEmbed] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const permalink = `${origin}/?url=${encodeURIComponent(report.host)}`;
  const badgeUrl = `${origin}/api/badge?grade=${encodeURIComponent(report.grade)}&score=${report.overallScore}`;
  const markdown = `[![Kalkan Güvenlik](${badgeUrl})](${permalink})`;
  const html = `<a href="${permalink}"><img src="${badgeUrl}" alt="Kalkan Güvenlik: ${report.grade}"></a>`;

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    });
  }

  return (
    <div className="mt-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-[color:var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[#04201c] transition-all hover:brightness-110"
        >
          📄 PDF olarak indir
        </button>
        <button
          onClick={() => copy(permalink, "link")}
          className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border-bright)] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[color:var(--color-accent)]"
        >
          🔗 {copied === "link" ? "Kopyalandı!" : "Paylaşılabilir link"}
        </button>
        <button
          onClick={() => setShowEmbed((s) => !s)}
          className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border-bright)] px-4 py-2.5 text-sm font-medium transition-colors hover:border-[color:var(--color-accent)]"
        >
          🛡 Rozet ekle
        </button>
      </div>

      {showEmbed && (
        <div className="mt-4 space-y-3 border-t border-[color:var(--color-border)] pt-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="Kalkan rozeti önizleme" className="h-5" />
            <span className="text-xs text-[color:var(--color-ink-dim)]">Sitenizin altına ekleyebileceğiniz rozet</span>
          </div>
          <EmbedRow label="Markdown" value={markdown} copied={copied === "md"} onCopy={() => copy(markdown, "md")} />
          <EmbedRow label="HTML" value={html} copied={copied === "html"} onCopy={() => copy(html, "html")} />
        </div>
      )}
    </div>
  );
}

function EmbedRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div className="mono mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-ink-faint)]">{label}</div>
      <div className="flex items-center gap-2">
        <code className="mono flex-1 truncate rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-base)] px-3 py-2 text-xs text-[color:var(--color-ink-dim)]">
          {value}
        </code>
        <button
          onClick={onCopy}
          className="shrink-0 rounded-lg border border-[color:var(--color-border-bright)] px-3 py-2 text-xs font-medium transition-colors hover:border-[color:var(--color-accent)]"
        >
          {copied ? "✓" : "Kopyala"}
        </button>
      </div>
    </div>
  );
}

function Stat({ n, label, color }: { n: number; label: string; color: string }) {
  return (
    <span
      className="mono rounded-lg px-2.5 py-1 text-xs font-medium"
      style={{ color: n > 0 ? color : "var(--color-ink-faint)", background: n > 0 ? `${color}1a` : "var(--color-surface-2)" }}
    >
      {n} {label}
    </span>
  );
}
