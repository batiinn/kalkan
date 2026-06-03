import { scan } from "@/scanner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#34d399";
  if (grade === "B") return "#84cc16";
  if (grade === "C") return "#f59e0b";
  if (grade === "D" || grade === "E") return "#fb7185";
  return "#f43f5e";
}

function textWidth(s: string): number {
  return Math.ceil(s.length * 6.4) + 14;
}

function buildSvg(label: string, value: string, color: string): string {
  const lw = textWidth(label);
  const vw = textWidth(value);
  const total = lw + vw;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <clipPath id="r"><rect width="${total}" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="20" fill="#1c2430"/>
    <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
    <rect width="${total}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="14">${label}</text>
    <text x="${lw + vw / 2}" y="14" fill="#04201c" font-weight="bold">${value}</text>
  </g>
</svg>`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gradeParam = searchParams.get("grade");
  const scoreParam = searchParams.get("score");
  const url = searchParams.get("url");

  let grade = gradeParam ?? "";
  let score = scoreParam ?? "";

  if ((!grade || !score) && url) {
    try {
      const report = await scan(url, 6000);
      grade = report.grade;
      score = String(report.overallScore);
    } catch {
      grade = "?";
      score = "0";
    }
  }

  const value = grade ? `${grade} · ${score || "0"}` : "tara";
  const color = grade ? gradeColor(grade) : "#2dd4bf";
  const svg = buildSvg("🛡 Kalkan", value, color);

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=3600",
    },
  });
}
