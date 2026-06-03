"use client";

import { useState } from "react";
import type { ModuleResult, Severity } from "@/scanner/types";
import { AlertIcon, CheckIcon, ChevronIcon, XIcon } from "./icons";

const SEV_META: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: "KRİTİK", color: "var(--color-crit)", bg: "rgba(244,63,94,0.12)" },
  high: { label: "YÜKSEK", color: "var(--color-high)", bg: "rgba(251,113,133,0.12)" },
  medium: { label: "ORTA", color: "var(--color-med)", bg: "rgba(245,158,11,0.12)" },
  low: { label: "DÜŞÜK", color: "var(--color-low)", bg: "rgba(234,179,8,0.12)" },
  info: { label: "BİLGİ", color: "var(--color-ink-dim)", bg: "rgba(138,151,168,0.1)" },
  ok: { label: "TAMAM", color: "var(--color-ok)", bg: "rgba(52,211,153,0.12)" },
};

function StatusIcon({ status }: { status: ModuleResult["status"] }) {
  if (status === "ok")
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "rgba(52,211,153,0.12)", color: "var(--color-ok)" }}>
        <CheckIcon className="h-5 w-5" />
      </span>
    );
  if (status === "fail")
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "rgba(244,63,94,0.12)", color: "var(--color-crit)" }}>
        <XIcon className="h-5 w-5" />
      </span>
    );
  if (status === "warn")
    return (
      <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "rgba(245,158,11,0.12)", color: "var(--color-med)" }}>
        <AlertIcon className="h-5 w-5" />
      </span>
    );
  return (
    <span className="grid h-9 w-9 place-items-center rounded-lg text-[color:var(--color-ink-faint)]" style={{ background: "var(--color-surface-2)" }}>
      ·
    </span>
  );
}

export function ModuleCard({ module, index }: { module: ModuleResult; index: number }) {
  const realFindings = module.findings.filter((f) => f.severity !== "ok");
  const [open, setOpen] = useState(realFindings.length > 0 && module.status === "fail");

  const scoreColor =
    module.score >= 85 ? "var(--color-ok)" : module.score >= 55 ? "var(--color-med)" : module.score >= 40 ? "var(--color-low)" : "var(--color-crit)";

  return (
    <div
      className="animate-fade-up overflow-hidden rounded-xl border bg-[color:var(--color-surface)] transition-colors hover:border-[color:var(--color-border-bright)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left">
        <StatusIcon status={module.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-[15px]">{module.title}</div>
          <div className="mono mt-0.5 text-xs text-[color:var(--color-ink-faint)]">
            {module.status === "error"
              ? "çalıştırılamadı"
              : realFindings.length > 0
                ? `${realFindings.length} bulgu`
                : "sorun yok"}
            {module.durationMs != null && ` · ${module.durationMs} ms`}
          </div>
        </div>
        <div className="mono shrink-0 text-sm font-semibold tabular-nums" style={{ color: scoreColor }}>
          {module.status === "error" ? "—" : `${module.score}`}
        </div>
        <ChevronIcon className={`h-4 w-4 shrink-0 text-[color:var(--color-ink-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-[color:var(--color-border)] px-4 py-3.5">
          {module.findings.map((f, i) => {
            const meta = SEV_META[f.severity];
            return (
              <div key={i} className="flex gap-3">
                <span
                  className="mono mt-0.5 h-fit shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider"
                  style={{ color: meta.color, background: meta.bg }}
                >
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-snug">{f.title}</div>
                  {f.detail && <div className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-ink-dim)]">{f.detail}</div>}
                  {f.remediation && (
                    <div className="mt-1.5 flex gap-1.5 text-[13px] leading-relaxed text-[color:var(--color-accent)]">
                      <span className="shrink-0">→</span>
                      <span>{f.remediation}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
