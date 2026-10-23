import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { cacheLife } from "next/cache";
import { getFile, listDir } from "./data-repo";
import {
  GLOSSARIES_DIR,
  type GlossaryTerm,
  glossaryTitle,
  parseGlossary,
  parseSourceTitles,
  type SourceTitles,
  sourcesPath,
} from "./glossary";

export interface EpicGlossary {
  key: string; // ej: "ABC-100"
  title: string;
  terms: GlossaryTerm[];
  sourceTitles: SourceTitles; // vacío si la épica no tiene <ÉPICA>.sources.json
}

export interface Glossaries {
  epics: EpicGlossary[];
  // De dónde salieron: el repo privado de datos, una carpeta glossaries/ local o el ejemplo ficticio del repo público.
  source: "github" | "local" | "example";
}

function toEpic(file: string, markdown: string, titlesJson?: string | null): EpicGlossary {
  const key = file.replace(/\.md$/, "");
  return {
    key,
    title: glossaryTitle(markdown) ?? key,
    terms: parseGlossary(markdown),
    sourceTitles: parseSourceTitles(titlesJson),
  };
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
      files.map(async (file) => {
        const [markdown, titles] = await Promise.all([
          getFile(`${GLOSSARIES_DIR}/${file}`),
          // Los títulos son opcionales: si fallan, se muestran solo las claves.
          getFile(sourcesPath(file.replace(/\.md$/, ""))).catch(() => null),
        ]);
        return toEpic(file, markdown?.text ?? "", titles?.text);
      }),
    );
    return { epics, source: "github" };
  }

  const localDir = path.join(/* turbopackIgnore: true */ process.cwd(), GLOSSARIES_DIR);
  if (existsSync(localDir)) {
    const files = readdirSync(localDir).filter((f) => f.endsWith(".md"));
    const epics = files.map((file) => {
      const titles = path.join(/* turbopackIgnore: true */ process.cwd(), sourcesPath(file.replace(/\.md$/, "")));
      return toEpic(file, readFileSync(path.join(localDir, file), "utf8"), existsSync(titles) ? readFileSync(titles, "utf8") : null);
    });
    return { epics, source: "local" };
  }

  const example = path.join(/* turbopackIgnore: true */ process.cwd(), "glossary.example.md");
  const epics = existsSync(example) ? [toEpic("ABC-100.md", readFileSync(example, "utf8"))] : [];
  return { epics, source: "example" };
}
