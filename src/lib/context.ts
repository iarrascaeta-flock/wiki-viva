import { connectors } from "@/connectors/registry";
import type { SourceDoc } from "@/connectors/types";

const TTL_MS = 10 * 60 * 1000;

export interface Snapshot {
  docs: SourceDoc[];
  markdown: string;
  approxTokens: number;
  fetchedAt: number;
}

const cache = new Map<string, Snapshot>();

// Trae todos los docs de una épica de las fuentes activas y los arma en un único markdown, cacheado 10 minutos.
export async function getSnapshot(epicKey: string): Promise<Snapshot> {
  const cached = cache.get(epicKey);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached;

  const sections: string[] = [];
  const docs: SourceDoc[] = [];
  for (const connector of connectors) {
    const connectorDocs = await connector.sync(epicKey);
    docs.push(...connectorDocs);
    sections.push(`## Fuente: ${connector.name}\n\n${connectorDocs.map((d) => d.content).join("\n\n")}`);
  }

  const markdown = sections.join("\n\n");
  const approxTokens = Math.round(markdown.length / 4);
  // stderr: en el MCP, stdout es el canal del protocolo.
  console.error(`[context] snapshot de ${epicKey}: ${docs.length} docs, ~${approxTokens} tokens`);

  const snapshot = { docs, markdown, approxTokens, fetchedAt: Date.now() };
  cache.set(epicKey, snapshot);
  return snapshot;
}
