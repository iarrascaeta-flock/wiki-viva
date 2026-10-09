// Extracción del glosario: npx tsx scripts/extract.ts
// Lee la épica, extrae términos por lotes, los fusiona y escribe glossary.draft.md.
// Los resultados de cada lote se cachean en extract.cache.local.json: si una corrida falla
// (por ejemplo, por límites de los modelos gratis), la siguiente retoma desde ahí.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { generateText, Output } from "ai";
import type { z } from "zod";

loadEnvConfig(process.cwd());

const BATCH_TOKENS = 8_000; // tamaño objetivo de cada lote (aprox. caracteres / 4)
const CALL_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 4;
const CACHE_FILE = "extract.cache.local.json";
const OUTPUT_FILE = "glossary.draft.md";

type Cache = Record<string, unknown>;

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  const { getSnapshot } = await import("@/lib/context");
  const { getModel } = await import("@/lib/model");
  const prompts = await import("@/lib/prompts");
  type Term = import("@/lib/prompts").Term;

  const { docs } = await getSnapshot();
  const validKeys = new Set(docs.map((d) => d.id));

  // Grupos: cada tarjeta de primer nivel con sus subtareas, para que el contexto quede junto.
  const groups: string[] = [];
  // getSnapshot() ya devuelve cada tarjeta seguida de sus subtareas.
  const epicKey = process.env.JIRA_EPIC_KEY;
  for (const doc of docs) {
    const isTopLevel = !doc.parentId || doc.parentId === epicKey || !validKeys.has(doc.parentId);
    if (isTopLevel || groups.length === 0) groups.push(doc.content);
    else groups[groups.length - 1] += `\n\n${doc.content}`;
  }

  // Lotes: grupos consecutivos hasta llegar a BATCH_TOKENS.
  const batches: string[] = [];
  for (const group of groups) {
    const last = batches.at(-1);
    if (last !== undefined && (last.length + group.length) / 4 <= BATCH_TOKENS) {
      batches[batches.length - 1] = `${last}\n\n${group}`;
    } else {
      batches.push(group);
    }
  }
  console.log(`${docs.length} tarjetas → ${groups.length} grupos → ${batches.length} lotes`);

  const cache: Cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
  const saveCache = () => writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

  // Reintentos manuales con log, para ver si una demora es lentitud del modelo o límites (429).
  async function generate<T>(system: string, prompt: string, schema: z.ZodType<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      try {
        const result = await generateText({
          model: getModel(),
          system,
          prompt,
          temperature: 0,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
          output: Output.object({ schema }),
        });
        const secs = Math.round((Date.now() - started) / 1000);
        console.log(
          `  ${result.response.modelId} · ${secs}s · entrada ${result.usage.inputTokens} / salida ${result.usage.outputTokens} tokens`,
        );
        return result.output;
      } catch (err) {
        const e = err as { statusCode?: number; message?: string };
        const secs = Math.round((Date.now() - started) / 1000);
        console.log(`  intento ${attempt} falló tras ${secs}s: ${e.statusCode ?? ""} ${String(e.message).slice(0, 160)}`);
        if (attempt >= MAX_ATTEMPTS) throw err;
        await new Promise((r) => setTimeout(r, 15_000 * attempt));
      }
    }
  }

  // 1. Extracción por lote.
  const extracted: Term[] = [];
  for (const [i, batch] of batches.entries()) {
    const key = `batch:${hash(prompts.EXTRACTION_SYSTEM + batch)}`;
    if (!cache[key]) {
      const started = Date.now();
      console.log(`Lote ${i + 1}/${batches.length} (~${Math.round(batch.length / 4)} tokens)...`);
      const { terms } = await generate(prompts.EXTRACTION_SYSTEM, prompts.extractionPrompt(batch), prompts.glossarySchema);
      cache[key] = terms;
      saveCache();
      console.log(`Lote ${i + 1}: ${(cache[key] as Term[]).length} términos en ${Math.round((Date.now() - started) / 1000)}s`);
    } else {
      console.log(`Lote ${i + 1}/${batches.length}: desde caché (${(cache[key] as Term[]).length} términos)`);
    }
    extracted.push(...(cache[key] as Term[]));
  }

  // Suma los datos de "from" en "into". Si los nombres difieren, el de "from" pasa a sinónimo.
  function mergeInto(into: Term, from: Term) {
    const extra = normalize(from.name) === normalize(into.name) ? [] : [from.name];
    into.synonyms = [...new Set([...into.synonyms, ...extra, ...from.synonyms])];
    into.sources = [...new Set([...into.sources, ...from.sources])];
    if (from.definition.length > into.definition.length) into.definition = from.definition;
    if (from.specialCases && !into.specialCases.includes(from.specialCases)) {
      into.specialCases = [into.specialCases, from.specialCases].filter(Boolean).join(" ");
    }
  }

  // 2. Fusión exacta por nombre normalizado (sin LLM).
  const byName = new Map<string, Term>();
  for (const t of extracted) {
    const prev = byName.get(normalize(t.name));
    if (prev) mergeInto(prev, t);
    else byName.set(normalize(t.name), { ...t, synonyms: [...t.synonyms], sources: [...t.sources] });
  }
  console.log(`${extracted.length} términos extraídos → ${byName.size} tras fusionar nombres iguales`);

  // 3. Sinónimos: el LLM solo ve nombres y sinónimos y devuelve grupos de duplicados; la fusión la hace el código.
  if (batches.length > 1) {
    const list = [...byName.values()];
    const key = `merge:${hash(prompts.MERGE_SYSTEM + prompts.mergePrompt(list))}`;
    if (!cache[key]) {
      console.log(`Agrupando sinónimos de ${list.length} términos...`);
      const { groups } = await generate(prompts.MERGE_SYSTEM, prompts.mergePrompt(list), prompts.mergeGroupsSchema);
      cache[key] = groups;
      saveCache();
    }
    let merged = 0;
    for (const group of cache[key] as z.infer<typeof prompts.mergeGroupsSchema>["groups"]) {
      const target = byName.get(normalize(group.canonical));
      if (!target) continue;
      for (const name of group.duplicates) {
        const dup = byName.get(normalize(name));
        if (!dup || dup === target) continue;
        mergeInto(target, dup);
        byName.delete(normalize(name));
        merged++;
      }
    }
    console.log(`${merged} duplicados fusionados → ${byName.size} términos`);
  }
  let terms = [...byName.values()];

  // 4. Validación: solo fuentes que existen en la épica; sin fuentes, el término se descarta.
  let dropped = 0;
  terms = terms.flatMap((t) => {
    const sources = [...new Set(t.sources.map((s) => s.trim().toUpperCase()))].filter((s) => validKeys.has(s));
    if (sources.length === 0) {
      dropped++;
      return [];
    }
    return [{ ...t, sources: sources.sort() }];
  });
  if (dropped > 0) console.log(`${dropped} términos descartados por no tener fuentes válidas`);

  // 5. Markdown.
  terms.sort((a, b) => normalize(a.name).localeCompare(normalize(b.name)));
  const sections = terms.map((t) =>
    [
      `## ${t.name.trim()}`,
      `**Siglas / sinónimos:** ${t.synonyms.length > 0 ? t.synonyms.join(", ") : "—"}`,
      `**Definición:** ${t.definition.trim()}`,
      ...(t.specialCases.trim() ? [`**Casos especiales:** ${t.specialCases.trim()}`] : []),
      `**Fuentes:** ${t.sources.join(", ")}`,
    ].join("\n"),
  );
  const header = `# Glosario (borrador)\n\nGenerado automáticamente el ${new Date().toISOString().slice(0, 10)} desde ${process.env.JIRA_EPIC_KEY}. Revisar a mano antes de guardarlo como glossary.md.\n`;
  writeFileSync(OUTPUT_FILE, `${header}\n${sections.join("\n\n")}\n`);
  console.log(`Escrito ${OUTPUT_FILE} con ${terms.length} términos`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
