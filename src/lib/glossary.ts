// Formato de los glosarios: un archivo glossaries/<ÉPICA>.md por épica, con un título "# ..." y
// secciones "## Término" con campos "**Campo:** valor". Sin dependencias de Next: lo usan el sitio y el MCP.

export interface GlossaryTerm {
  slug: string;
  name: string;
  synonyms: string[];
  definition: string;
  specialCases?: string;
  sources: string[];
}

export const GLOSSARIES_DIR = "glossaries";
export const ISSUE_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

export function glossaryPath(epicKey: string): string {
  return `${GLOSSARIES_DIR}/${epicKey}.md`;
}

// Títulos de las tarjetas citadas en "Fuentes" (clave → título). Los escribe el MCP al publicar, desde Jira,
// para que el sitio los muestre sin consultar Jira.
export type SourceTitles = Record<string, string>;

export function sourcesPath(epicKey: string): string {
  return `${GLOSSARIES_DIR}/${epicKey}.sources.json`;
}

export function parseSourceTitles(json: string | null | undefined): SourceTitles {
  if (!json) return {};
  try {
    return JSON.parse(json) as SourceTitles;
  } catch {
    return {};
  }
}

const FIELDS: Record<string, keyof GlossaryTerm> = {
  "siglas / sinónimos": "synonyms",
  "definición": "definition",
  "casos especiales": "specialCases",
  fuentes: "sources",
};

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s !== "—" && s !== "-");
}

// Título del glosario: la primera línea "# ...", si la hay.
export function glossaryTitle(markdown: string): string | undefined {
  return markdown.match(/^# (.+)$/m)?.[1].trim();
}

// Parsea el glosario por secciones "## Término" con campos "**Campo:** valor" (pueden ocupar varias líneas).
export function parseGlossary(markdown: string): GlossaryTerm[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .map((section) => {
      const [nameLine, ...lines] = section.split("\n");
      const values: Partial<Record<keyof GlossaryTerm, string>> = {};
      let current: keyof GlossaryTerm | undefined;
      for (const line of lines) {
        const match = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
        const field = match ? FIELDS[match[1].trim().toLowerCase()] : undefined;
        if (match && field) {
          current = field;
          values[field] = match[2];
        } else if (current && line.trim()) {
          values[current] += `\n${line}`;
        }
      }
      const name = nameLine.trim();
      return {
        slug: slugify(name),
        name,
        synonyms: splitList(values.synonyms ?? ""),
        definition: (values.definition ?? "").trim(),
        specialCases: values.specialCases?.trim() || undefined,
        sources: splitList(values.sources ?? ""),
      };
    })
    .filter((t) => t.name);
}

// Problemas de formato que impiden publicar: lista vacía si el glosario está bien.
export function validateGlossary(markdown: string): string[] {
  const terms = parseGlossary(markdown);
  if (terms.length === 0) return ['No hay términos: cada uno va en una sección "## Término".'];
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const t of terms) {
    if (!t.definition) problems.push(`"${t.name}" no tiene **Definición:**.`);
    const invalid = t.sources.filter((s) => !ISSUE_KEY.test(s));
    if (invalid.length > 0) problems.push(`"${t.name}" tiene fuentes que no son claves de Jira: ${invalid.join(", ")}.`);
    for (const slug of [t.slug, ...t.synonyms.map(slugify)]) {
      const other = seen.get(slug);
      if (other && other !== t.name) problems.push(`"${t.name}" repite un nombre o sinónimo de "${other}".`);
      seen.set(slug, t.name);
    }
  }
  return problems;
}

// Formato de un término (el mismo que parsea parseGlossary).
export function formatTerm(t: Omit<GlossaryTerm, "slug">): string {
  const oneLine = (s: string) => s.replace(/\s*\n\s*/g, " ").trim();
  return [
    `## ${oneLine(t.name)}`,
    `**Siglas / sinónimos:** ${t.synonyms.length > 0 ? t.synonyms.map(oneLine).join(", ") : "—"}`,
    `**Definición:** ${oneLine(t.definition)}`,
    ...(t.specialCases?.trim() ? [`**Casos especiales:** ${oneLine(t.specialCases)}`] : []),
    `**Fuentes:** ${t.sources.length > 0 ? t.sources.join(", ") : "—"}`,
  ].join("\n");
}
