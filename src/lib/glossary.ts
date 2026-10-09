import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";

export interface GlossaryTerm {
  slug: string;
  name: string;
  synonyms: string[];
  definition: string;
  specialCases?: string;
  sources: string[];
}

export interface Glossary {
  markdown: string;
  terms: GlossaryTerm[];
  // De dónde salió: el repo privado de datos, un glossary.md local, el borrador (solo en
  // desarrollo) o el ejemplo ficticio del repo público.
  source: "github" | "local" | "draft" | "example";
}

export const GLOSSARY_TAG = "glossary";
export const GLOSSARY_FILE = "glossary.md";

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

// Formato de un término en glossary.md (el mismo que parsea parseGlossary).
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

// Lee el glosario de GLOSSARY_REPO (repo privado) vía la API de GitHub. Sin GLOSSARY_REPO, usa un
// glossary.md local, el borrador (solo en desarrollo) o glossary.example.md.
// Se cachea con el tag GLOSSARY_TAG: /api/suggest lo invalida al agregar un término.
export async function loadGlossary(): Promise<Glossary> {
  "use cache";
  cacheTag(GLOSSARY_TAG);
  cacheLife("hours");

  const repo = process.env.GLOSSARY_REPO;
  if (repo) {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${GLOSSARY_FILE}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) throw new Error(`No se pudo leer el glosario de GitHub (${res.status})`);
    const markdown = await res.text();
    return { markdown, terms: parseGlossary(markdown), source: "github" };
  }

  const candidates: [string, Glossary["source"]][] = [
    [GLOSSARY_FILE, "local"],
    ...(process.env.NODE_ENV === "development" ? [["glossary.draft.md", "draft"] as [string, Glossary["source"]]] : []),
    ["glossary.example.md", "example"],
  ];
  for (const [file, source] of candidates) {
    const full = path.join(process.cwd(), file);
    if (existsSync(full)) {
      const markdown = readFileSync(full, "utf8");
      return { markdown, terms: parseGlossary(markdown), source };
    }
  }
  return { markdown: "", terms: [], source: "example" };
}
