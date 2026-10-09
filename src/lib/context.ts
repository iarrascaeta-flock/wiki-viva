import { connectors } from "@/connectors/registry";
import type { SourceDoc } from "@/connectors/types";

const TTL_MS = 10 * 60 * 1000;

export interface Snapshot {
  docs: SourceDoc[];
  markdown: string;
  approxTokens: number;
  fetchedAt: number;
}

let cache: Snapshot | null = null;

// Trae todos los docs de las fuentes activas y los arma en un único markdown, cacheado 10 minutos.
export async function getSnapshot(): Promise<Snapshot> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache;

  const sections: string[] = [];
  const docs: SourceDoc[] = [];
  for (const connector of connectors) {
    if (!connector.sync) continue;
    const connectorDocs = await connector.sync();
    docs.push(...connectorDocs);
    sections.push(`## Fuente: ${connector.name}\n\n${connectorDocs.map((d) => d.content).join("\n\n")}`);
  }

  const markdown = sections.join("\n\n");
  const approxTokens = Math.round(markdown.length / 4);
  console.log(`[context] snapshot: ${docs.length} docs, ~${approxTokens} tokens`);

  cache = { docs, markdown, approxTokens, fetchedAt: Date.now() };
  return cache;
}
