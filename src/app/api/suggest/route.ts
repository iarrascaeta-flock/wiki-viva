import { revalidateTag } from "next/cache";
import { formatTerm, GLOSSARY_FILE, GLOSSARY_TAG, parseGlossary, slugify } from "@/lib/glossary";

// "Agregar al glosario": agrega el término al final de glossary.md en el repo privado de datos
// (GLOSSARY_REPO) con un commit vía la API de GitHub, e invalida la caché del glosario.

const FILE = GLOSSARY_FILE;
const ISSUE_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

interface SuggestBody {
  name?: string;
  synonyms?: string;
  definition?: string;
  specialCases?: string;
  sources?: string;
  question?: string;
}

function github(path: string, init?: RequestInit) {
  return fetch(`https://api.github.com/repos/${process.env.GLOSSARY_REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
    cache: "no-store",
  });
}

function list(value?: string): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Usuario de basic auth que hizo el pedido, para dejarlo en el commit.
function requester(req: Request): string {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return "desconocido";
  return atob(header.slice(6)).split(":")[0] || "desconocido";
}

function fail(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  if (!process.env.GITHUB_TOKEN || !process.env.GLOSSARY_REPO) {
    return fail("Agregar al glosario no está configurado (falta GITHUB_TOKEN o GLOSSARY_REPO).", 500);
  }

  const body = (await req.json()) as SuggestBody;
  const name = body.name?.trim() ?? "";
  const definition = body.definition?.trim() ?? "";
  const sources = list(body.sources).map((s) => s.toUpperCase());

  if (name.length < 2 || name.length > 100) return fail("El nombre del término es obligatorio (2 a 100 caracteres).", 400);
  if (definition.length < 10) return fail("La definición es obligatoria (al menos 10 caracteres).", 400);
  const projectKey = process.env.JIRA_PROJECT_KEY;
  const invalid = sources.filter((s) => !ISSUE_KEY.test(s) || (projectKey && !s.startsWith(`${projectKey}-`)));
  if (invalid.length > 0) return fail(`Fuentes inválidas: ${invalid.join(", ")}. Usá claves de Jira, ej: ${projectKey ?? "ABC"}-123.`, 400);

  const term = formatTerm({
    name,
    synonyms: list(body.synonyms),
    definition,
    specialCases: body.specialCases?.trim() || undefined,
    sources,
  });
  const branch = "main";
  const user = requester(req);

  // Dos intentos: si otro commit cambió el archivo entre la lectura y la escritura, GitHub responde 409.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const current = await github(`/contents/${FILE}?ref=${branch}`);
    if (!current.ok) return fail(`No se pudo leer ${FILE} en GitHub (${current.status}).`, 502);
    const { sha, content } = (await current.json()) as { sha: string; content: string };
    const markdown = Buffer.from(content, "base64").toString("utf8");

    const slug = slugify(name);
    const existing = parseGlossary(markdown).find(
      (t) => t.slug === slug || t.synonyms.some((s) => slugify(s) === slug),
    );
    if (existing) return fail(`"${name}" ya está en el glosario como "${existing.name}".`, 409);

    const updated = `${markdown.trimEnd()}\n\n${term}\n`;
    const message = [
      `glosario: agregar "${name}"`,
      "",
      `Agregado desde el chat por ${user}.`,
      ...(body.question?.trim() ? [`Pregunta original: ${body.question.trim().slice(0, 300)}`] : []),
    ].join("\n");

    const res = await github(`/contents/${FILE}`, {
      method: "PUT",
      body: JSON.stringify({ message, content: Buffer.from(updated, "utf8").toString("base64"), sha, branch }),
    });
    if (res.ok) {
      const { commit } = (await res.json()) as { commit: { html_url: string } };
      revalidateTag(GLOSSARY_TAG, { expire: 0 });
      return Response.json({ ok: true, name, commitUrl: commit.html_url });
    }
    if (res.status !== 409 || attempt === 2) {
      console.error("[suggest] GitHub respondió", res.status, (await res.text()).slice(0, 300));
      return fail(`GitHub rechazó el cambio (${res.status}). Probá de nuevo en un rato.`, 502);
    }
  }
  return fail("No se pudo guardar el término.", 502);
}
