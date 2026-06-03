#!/usr/bin/env node
import { scanStream } from "./index";
import type { ModuleResult, Severity } from "./types";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const SEV_COLOR: Record<Severity, string> = {
  critical: c.red,
  high: c.red,
  medium: c.yellow,
  low: c.yellow,
  info: c.gray,
  ok: c.green,
};

const SEV_LABEL: Record<Severity, string> = {
  critical: "KRİTİK",
  high: "YÜKSEK",
  medium: "ORTA",
  low: "DÜŞÜK",
  info: "BİLGİ",
  ok: "TAMAM",
};

function printModule(m: ModuleResult) {
  const icon = m.status === "ok" ? `${c.green}✓` : m.status === "warn" ? `${c.yellow}!` : m.status === "fail" ? `${c.red}✗` : `${c.gray}·`;
  console.log(`\n${icon} ${c.bold}${m.title}${c.reset} ${c.dim}(${m.score}/100)${c.reset}`);
  for (const f of m.findings) {
    const col = SEV_COLOR[f.severity];
    console.log(`  ${col}[${SEV_LABEL[f.severity]}]${c.reset} ${f.title}`);
    if (f.detail) console.log(`      ${c.gray}${f.detail}${c.reset}`);
    if (f.remediation) console.log(`      ${c.cyan}→ ${f.remediation}${c.reset}`);
  }
}

function parseFlagValue(name: string): string | undefined {
  const eq = process.argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.split("=")[1];
  const idx = process.argv.indexOf(name);
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith("-")) {
    return process.argv[idx + 1];
  }
  return undefined;
}

async function main() {
  const target = process.argv[2];
  if (!target || target === "-h" || target === "--help") {
    console.log(`
${c.bold}Kalkan${c.reset} — açık kaynak web güvenlik tarayıcısı

Kullanım:
  ${c.cyan}kalkan <alan-adı>${c.reset}
  ${c.cyan}kalkan example.com${c.reset}
  ${c.cyan}kalkan https://example.com --json${c.reset}
  ${c.cyan}kalkan example.com --fail-under 70${c.reset}   ${c.gray}(CI: puan eşiğin altındaysa hata kodu)${c.reset}

Seçenekler:
  --json               Sonucu JSON olarak yazdırır
  --fail-under <0-100> Genel puan bu değerin altındaysa exit code 1 döner (CI için)
  --fail-on <sev>      Bu ciddiyette (critical|high|medium) bulgu varsa exit code 1
`);
    process.exit(target ? 0 : 1);
  }

  const asJson = process.argv.includes("--json");
  const failUnder = parseFlagValue("--fail-under");
  const failUnderScore = failUnder !== undefined ? Number(failUnder) : null;
  const failOn = parseFlagValue("--fail-on") as "critical" | "high" | "medium" | undefined;

  if (!asJson) {
    console.log(`\n${c.bold}${c.cyan}🛡  Kalkan${c.reset} taraması başlıyor: ${c.bold}${target}${c.reset}`);
  }

  for await (const event of scanStream(target)) {
    if (event.type === "error") {
      console.error(`${c.red}Hata:${c.reset} ${event.message}`);
      process.exit(1);
    }
    if (!asJson && event.type === "module") {
      printModule(event.result);
    }
    if (event.type === "done") {
      const r = event.report;
      if (asJson) {
        console.log(JSON.stringify(r, null, 2));
      } else {
        const gradeColor = r.overallScore >= 70 ? c.green : r.overallScore >= 40 ? c.yellow : c.red;
        console.log(`\n${c.bold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
        console.log(`${c.bold}Genel Puan:${c.reset} ${gradeColor}${c.bold}${r.overallScore}/100  (${r.grade})${c.reset}`);
        console.log(
          `${c.red}${r.summary.critical} kritik${c.reset}  ${c.red}${r.summary.high} yüksek${c.reset}  ${c.yellow}${r.summary.medium} orta${c.reset}  ${c.yellow}${r.summary.low} düşük${c.reset}`,
        );
        console.log(`${c.gray}${r.durationMs} ms${c.reset}`);
      }

      let failed = false;
      let reason = "";
      if (failUnderScore !== null && r.overallScore < failUnderScore) {
        failed = true;
        reason = `Genel puan ${r.overallScore}, eşik ${failUnderScore} altında.`;
      }
      if (failOn) {
        const order = { medium: 0, high: 1, critical: 2 } as const;
        const minLevel = order[failOn];
        const counts = r.summary;
        const triggered =
          (minLevel <= 2 && counts.critical > 0) ||
          (minLevel <= 1 && counts.high > 0) ||
          (minLevel <= 0 && counts.medium > 0);
        if (triggered) {
          failed = true;
          reason = `'${failOn}' ve üzeri ciddiyette bulgu mevcut.`;
        }
      }
      if (failed) {
        if (!asJson) console.error(`\n${c.red}✗ Eşik aşıldı:${c.reset} ${reason}`);
        process.exit(1);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
