// Prueba del conector de Jira: npx tsx scripts/jira-check.ts ABC-100 [--write]
// Sin clave usa JIRA_EPIC_KEY.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const epicKey = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? process.env.JIRA_EPIC_KEY;
  if (!epicKey) throw new Error("Pasá la clave de la épica: npx tsx scripts/jira-check.ts ABC-100");
  const { getSnapshot } = await import("@/lib/context");
  const { docs, approxTokens, markdown } = await getSnapshot(epicKey);

  const byType: Record<string, number> = {};
  for (const d of docs) byType[d.type] = (byType[d.type] ?? 0) + 1;
  const comments = docs.reduce((sum, d) => sum + Number(d.metadata?.commentCount ?? 0), 0);
  const latest = docs.map((d) => d.updatedAt).sort().at(-1);

  console.log("Tarjetas por tipo:");
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(20)} ${count}`);
  }
  console.log(`Total tarjetas:       ${docs.length}`);
  console.log(`Total comentarios:    ${comments}`);
  console.log(`Última actualización: ${latest}`);
  console.log(`Snapshot:             ${markdown.length} caracteres, ~${approxTokens} tokens`);

  if (process.argv.includes("--write")) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync("snapshot.local.md", markdown);
    console.log("Escrito snapshot.local.md");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
