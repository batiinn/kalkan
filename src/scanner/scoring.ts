import type { Finding, Grade, ModuleResult, ScanReport, Severity } from "./types";

const SEVERITY_PENALTY: Record<Severity, number> = {
  ok: 0,
  info: 0,
  low: 8,
  medium: 18,
  high: 35,
  critical: 60,
};

export function scoreFindings(findings: Finding[]): number {
  let score = 100;
  for (const f of findings) {
    score -= SEVERITY_PENALTY[f.severity] ?? 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveStatus(findings: Finding[]): ModuleResult["status"] {
  const worst = findings.reduce<Severity>((acc, f) => {
    const order: Severity[] = ["ok", "info", "low", "medium", "high", "critical"];
    return order.indexOf(f.severity) > order.indexOf(acc) ? f.severity : acc;
  }, "ok");

  if (worst === "critical" || worst === "high") return "fail";
  if (worst === "medium" || worst === "low") return "warn";
  return "ok";
}

const MODULE_WEIGHTS: Record<string, number> = {
  tls: 1.4,
  headers: 1.3,
  email: 1.2,
  exposed: 1.5,
  ports: 1.5,
  cors: 1.1,
  cookies: 1.0,
  redirect: 0.9,
  mixed: 0.9,
  wordpress: 1.0,
  dns: 0.7,
  subdomains: 0.6,
  tech: 0.5,
};

export function computeOverall(modules: ModuleResult[]): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const m of modules) {
    if (m.status === "error") continue;
    const w = MODULE_WEIGHTS[m.id] ?? 1;
    weightedSum += m.score * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedSum / totalWeight);
}

export function toGrade(score: number): Grade {
  if (score >= 95) return "A+";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  if (score >= 25) return "E";
  return "F";
}

export function summarize(modules: ModuleResult[]): ScanReport["summary"] {
  const summary = { critical: 0, high: 0, medium: 0, low: 0, ok: 0 };
  for (const m of modules) {
    for (const f of m.findings) {
      if (f.severity === "critical") summary.critical++;
      else if (f.severity === "high") summary.high++;
      else if (f.severity === "medium") summary.medium++;
      else if (f.severity === "low") summary.low++;
      else summary.ok++;
    }
  }
  return summary;
}
