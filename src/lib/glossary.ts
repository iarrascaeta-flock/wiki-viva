import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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
  isDraft: boolean; // true si se está mostrando glossary.draft.md (solo en desarrollo)
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

// Lee glossary.md. En desarrollo, si todavía no existe, usa glossary.draft.md para poder ver la página.
export function loadGlossary(): Glossary {
  const file = path.join(process.cwd(), "glossary.md");
  const draft = path.join(process.cwd(), "glossary.draft.md");
  let markdown = "";
  let isDraft = false;
  if (existsSync(file)) {
    markdown = readFileSync(file, "utf8");
  } else if (process.env.NODE_ENV === "development" && existsSync(draft)) {
    markdown = readFileSync(draft, "utf8");
    isDraft = true;
  }
  return { markdown, terms: parseGlossary(markdown), isDraft };
}
