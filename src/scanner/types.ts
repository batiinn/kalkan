export type Severity = "ok" | "info" | "low" | "medium" | "high" | "critical";

export type ModuleStatus = "ok" | "warn" | "fail" | "error";

export interface Finding {
  title: string;
  severity: Severity;
  detail?: string;
  remediation?: string;
}

export interface ModuleResult {
  id: string;
  title: string;
  status: ModuleStatus;
  score: number;
  findings: Finding[];
  meta?: Record<string, unknown>;
  durationMs?: number;
}

export interface ScanModule {
  id: string;
  title: string;
  run: (ctx: ScanContext) => Promise<ModuleResult>;
}

export interface ScanContext {
  url: string;
  host: string;
  protocol: "http:" | "https:";
  timeoutMs: number;
}

export interface ScanReport {
  host: string;
  url: string;
  startedAt: string;
  durationMs: number;
  overallScore: number;
  grade: Grade;
  modules: ModuleResult[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    ok: number;
  };
}

export type Grade = "A+" | "A" | "B" | "C" | "D" | "E" | "F";

export type ScanEvent =
  | { type: "start"; host: string; url: string; modules: string[] }
  | { type: "module"; result: ModuleResult }
  | { type: "done"; report: ScanReport }
  | { type: "error"; message: string };
