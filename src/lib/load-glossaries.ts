import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cacheLife } from "next/cache";
import { getFile, listDir } from "./data-repo";
import { GLOSSARIES_DIR, type GlossaryTerm, glossaryTitle, parseGlossary } from "./glossary";

export interface EpicGlossary {
  key: string; // ej: "ABC-100"
  title: string;
  terms: GlossaryTerm[];
}

export interface Glossaries {
  epics: EpicGlossary[];
  // De dónde salieron: el repo privado de datos, una carpeta glossaries/ local o el ejemplo ficticio del repo público.
  source: "github" | "local" | "example";
}

function toEpic(file: string, markdown: string): EpicGlossary {
  const key = file.replace(/\.md$/, "");
  return { key, title: glossaryTitle(markdown) ?? key, terms: parseGlossary(markdown) };
}

// Lee glossaries/*.md de GLOSSARY_REPO (repo privado). Sin GLOSSARY_REPO, usa una carpeta glossaries/
// local o glossary.example.md. Los mantenedores publican desde el MCP: la caché corta (~1 minuto) hace
// que los cambios aparezcan solos.
export async function loadGlossaries(): Promise<Glossaries> {
  "use cache";
  cacheLife("minutes");

  if (process.env.GLOSSARY_REPO) {
    const files = (await listDir(GLOSSARIES_DIR)).filter((f) => f.endsWith(".md"));
    const epics = await Promise.all(
      files.map(async (file) => toEpic(file, (await getFile(`${GLOSSARIES_DIR}/${file}`))?.text ?? "")),
    );
    return { epics, source: "github" };
  }

  const localDir = path.join(/* turbopackIgnore: true */ process.cwd(), GLOSSARIES_DIR);
  if (existsSync(localDir)) {
    const files = readdirSync(localDir).filter((f) => f.endsWith(".md"));
    const epics = files.map((file) => toEpic(file, readFileSync(path.join(localDir, file), "utf8")));
    return { epics, source: "local" };
  }

  const example = path.join(/* turbopackIgnore: true */ process.cwd(), "glossary.example.md");
  const epics = existsSync(example) ? [toEpic("ABC-100.md", readFileSync(example, "utf8"))] : [];
  return { epics, source: "example" };
}
