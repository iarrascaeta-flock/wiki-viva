// Claves de issue de Jira (ej: ABC-123) y marcador de "sin datos" en las respuestas del chat.
// Se usa del lado del cliente: no importar nada de servidor acá.

export const ISSUE_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const NO_DATA_RE = /\[SIN_DATOS:\s*([^\]]+)\]/;

export type Segment = { type: "text"; value: string } | { type: "issue"; key: string };

// Parte el texto en tramos de texto y claves de issue. Con projectKey, solo se linkean las claves
// de ese proyecto (así "COVID-19" no se convierte en link).
export function splitCitations(text: string, projectKey?: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(ISSUE_KEY_RE)) {
    const key = match[0];
    if (projectKey && !key.startsWith(`${projectKey}-`)) continue;
    if (match.index > last) segments.push({ type: "text", value: text.slice(last, match.index) });
    segments.push({ type: "issue", key });
    last = match.index + key.length;
  }
  if (last < text.length) segments.push({ type: "text", value: text.slice(last) });
  return segments;
}

export function issueUrl(jiraBaseUrl: string, key: string): string {
  return `${jiraBaseUrl}/browse/${key}`;
}

// Saca el marcador [SIN_DATOS: término] del texto y devuelve el término, si lo hay.
export function extractNoData(text: string): { text: string; term?: string } {
  const match = text.match(NO_DATA_RE);
  if (!match) return { text };
  return { text: text.replace(NO_DATA_RE, "").trim(), term: match[1].trim() };
}
