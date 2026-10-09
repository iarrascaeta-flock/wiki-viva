import type { SourceConnector, SourceDoc } from "./types";

// Nombres de tipo de Jira (en minúscula) → tipo normalizado.
// Los nombres dependen del idioma y la configuración del proyecto: agregar acá los que falten.
// Un tipo que no está en el mapa se conserva con su nombre original.
const TYPE_MAP: Record<string, string> = {
  epic: "epic",
  "épica": "epic",
  historia: "story",
  story: "story",
  subtarea: "subtask",
  "sub-task": "subtask",
  subtask: "subtask",
  error: "bug",
  bug: "bug",
  "bug-test": "bug_test",
  "bug test": "bug_test",
};

// Tipos que no se traen (nombre original en Jira). Los casos de prueba consumen muchos tokens
// y no aportan terminología nueva respecto de sus historias.
const EXCLUDED_TYPES = ["TEST"];

const FIELDS = ["issuetype", "summary", "description", "status", "parent", "comment", "updated"];
const BATCH_SIZE = 50;

// Nodo de Atlassian Document Format (descripción y comentarios).
interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: AdfNode[];
}

interface JiraComment {
  author?: { displayName?: string };
  created: string;
  body: AdfNode | null;
}

interface JiraIssue {
  key: string;
  fields: {
    issuetype: { name: string };
    summary: string;
    description: AdfNode | null;
    status: { name: string };
    parent?: { key: string };
    comment: { total: number; comments: JiraComment[] };
    updated: string;
  };
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

async function jiraFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = Buffer.from(`${env("JIRA_EMAIL")}:${env("JIRA_API_TOKEN")}`).toString("base64");
  const res = await fetch(`${env("JIRA_BASE_URL")}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira respondió ${res.status} en ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

async function search(baseJql: string): Promise<JiraIssue[]> {
  const excluded = EXCLUDED_TYPES.map((t) => `"${t}"`).join(", ");
  const jql = excluded ? `(${baseJql}) AND issuetype not in (${excluded})` : baseJql;
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await jiraFetch<{ issues: JiraIssue[]; nextPageToken?: string }>(
      "/rest/api/3/search/jql",
      { method: "POST", body: JSON.stringify({ jql, fields: FIELDS, maxResults: 100, nextPageToken }) },
    );
    issues.push(...page.issues);
    nextPageToken = page.nextPageToken;
  } while (nextPageToken);
  return issues;
}

// La búsqueda puede traer los comentarios truncados: completar con el endpoint de comentarios.
async function fetchAllComments(issue: JiraIssue): Promise<JiraComment[]> {
  const { total, comments } = issue.fields.comment;
  if (total <= comments.length) return comments;
  const all: JiraComment[] = [];
  while (all.length < total) {
    const page = await jiraFetch<{ comments: JiraComment[] }>(
      `/rest/api/3/issue/${issue.key}/comment?startAt=${all.length}&maxResults=100`,
    );
    if (page.comments.length === 0) break;
    all.push(...page.comments);
  }
  return all;
}

// --- ADF → markdown simple ---

function inline(nodes: AdfNode[] = []): string {
  return nodes.map(inlineNode).join("");
}

function inlineNode(node: AdfNode): string {
  switch (node.type) {
    case "text": {
      let text = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "strong") text = `**${text}**`;
        else if (mark.type === "em") text = `*${text}*`;
        else if (mark.type === "code") text = `\`${text}\``;
        else if (mark.type === "strike") text = `~~${text}~~`;
        else if (mark.type === "link") text = `[${text}](${String(mark.attrs?.href ?? "")})`;
      }
      return text;
    }
    case "hardBreak":
      return "\n";
    case "mention":
      return String(node.attrs?.text ?? "@usuario");
    case "emoji":
      return String(node.attrs?.text ?? node.attrs?.shortName ?? "");
    case "inlineCard":
      return String(node.attrs?.url ?? "");
    case "mediaInline":
      return "[adjunto]";
    default:
      return inline(node.content);
  }
}

function block(node: AdfNode, indent = ""): string {
  switch (node.type) {
    case "paragraph":
      return indent + inline(node.content);
    case "heading":
      return `${indent}**${inline(node.content)}**`;
    case "bulletList":
    case "orderedList":
      return (node.content ?? [])
        .map((item, i) => {
          const bullet = node.type === "orderedList" ? `${i + 1}. ` : "- ";
          const children = item.content ?? [];
          // Un ítem que arranca con una lista anidada no lleva viñeta propia.
          if (children[0]?.type !== "paragraph") return children.map((c) => block(c, indent)).join("\n");
          const [first = "", ...rest] = children.map((c) => block(c, indent + "  "));
          return [indent + bullet + first.trimStart(), ...rest].join("\n");
        })
        .join("\n");
    case "codeBlock":
      return `${indent}\`\`\`\n${inline(node.content)}\n${indent}\`\`\``;
    case "table":
      return (node.content ?? [])
        .map((row) => indent + "| " + (row.content ?? []).map((cell) => cellText(cell)).join(" | ") + " |")
        .join("\n");
    case "rule":
      return "";
    case "mediaSingle":
    case "mediaGroup":
    case "media":
      return indent + "[adjunto]";
    default:
      return node.content ? node.content.map((c) => block(c, indent)).join("\n") : indent + inlineNode(node);
  }
}

function cellText(cell: AdfNode): string {
  return (cell.content ?? []).map((c) => block(c)).join(" ").replace(/\s*\n\s*/g, " ").trim();
}

export function adfToMarkdown(doc: AdfNode | null): string {
  if (!doc) return "";
  return (doc.content ?? [])
    .map((n) => block(n))
    .filter((s) => s.trim() !== "")
    .join("\n")
    .trim();
}

// --- JiraIssue → SourceDoc ---

function normalizeType(name: string): string {
  return TYPE_MAP[name.trim().toLowerCase()] ?? name;
}

function toSourceDoc(issue: JiraIssue, comments: JiraComment[]): SourceDoc {
  const f = issue.fields;
  const description = adfToMarkdown(f.description);
  const lines = [
    `### ${issue.key} · ${f.issuetype.name} · ${f.status.name} · actualizada ${f.updated.slice(0, 10)}`,
    ...(f.parent ? [`Padre: ${f.parent.key}`] : []),
    `**Título:** ${f.summary}`,
    `**Descripción:** ${description || "(sin descripción)"}`,
  ];
  if (comments.length > 0) {
    lines.push("**Comentarios:**");
    for (const c of comments) {
      const text = adfToMarkdown(c.body).replace(/\n/g, "\n  ");
      lines.push(`- ${c.created.slice(0, 10)} · ${c.author?.displayName ?? "Desconocido"}: ${text}`);
    }
  }

  return {
    id: issue.key,
    title: f.summary,
    url: `${env("JIRA_BASE_URL")}/browse/${issue.key}`,
    type: normalizeType(f.issuetype.name),
    parentId: f.parent?.key,
    updatedAt: new Date(f.updated).toISOString(),
    content: lines.join("\n"),
    metadata: { status: f.status.name, originalType: f.issuetype.name, commentCount: comments.length },
  };
}

async function sync(): Promise<SourceDoc[]> {
  const epicKey = env("JIRA_EPIC_KEY");

  // 1. La épica. 2. Sus hijos directos. 3. Las subtareas de esos hijos, en lotes.
  // En los tres pasos se excluyen los EXCLUDED_TYPES.
  const epic = await search(`key = ${epicKey}`);
  const children = await search(env("JIRA_EPIC_JQL"));
  const subtasks: JiraIssue[] = [];
  for (let i = 0; i < children.length; i += BATCH_SIZE) {
    const keys = children.slice(i, i + BATCH_SIZE).map((c) => c.key);
    subtasks.push(...(await search(`parent in (${keys.join(", ")})`)));
  }

  // Orden de lectura: épica, y cada hijo seguido de sus subtareas.
  const byParent = new Map<string, JiraIssue[]>();
  for (const s of subtasks) {
    const parent = s.fields.parent?.key ?? "";
    byParent.set(parent, [...(byParent.get(parent) ?? []), s]);
  }
  const ordered = [...epic, ...children.flatMap((c) => [c, ...(byParent.get(c.key) ?? [])])];

  const docs: SourceDoc[] = [];
  for (const issue of ordered) {
    docs.push(toSourceDoc(issue, await fetchAllComments(issue)));
  }
  return docs;
}

export const jiraConnector: SourceConnector = {
  id: "jira",
  name: "Jira",
  sync,
};
