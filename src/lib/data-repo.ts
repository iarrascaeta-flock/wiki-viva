// Acceso al repo privado de datos (GLOSSARY_REPO) vía la API de contenidos de GitHub.
// Sin dependencias de Next: lo usan el sitio (solo lectura) y el MCP (lectura y escritura).

export interface RepoFile {
  text: string;
  sha: string;
}

function repo(): string {
  const value = process.env.GLOSSARY_REPO;
  if (!value) throw new Error("Falta la variable de entorno GLOSSARY_REPO");
  return value;
}

function github(path: string, init?: RequestInit) {
  return fetch(`https://api.github.com${path}`, {
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

// Contenido y sha de un archivo, o null si no existe.
export async function getFile(path: string): Promise<RepoFile | null> {
  const res = await github(`/repos/${repo()}/contents/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo leer ${path} de GitHub (${res.status})`);
  const { sha, content } = (await res.json()) as { sha: string; content: string };
  return { text: Buffer.from(content, "base64").toString("utf8"), sha };
}

// Nombres de los archivos de una carpeta; vacío si la carpeta no existe.
export async function listDir(path: string): Promise<string[]> {
  const res = await github(`/repos/${repo()}/contents/${path}`);
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`No se pudo listar ${path} en GitHub (${res.status})`);
  const items = (await res.json()) as { name: string; type: string }[];
  return items.filter((i) => i.type === "file").map((i) => i.name);
}

// Lee el archivo, aplica el cambio y lo commitea. Reintenta una vez si otro commit lo cambió en el medio (409).
// update recibe el texto actual (null si no existe) y devuelve el nuevo, o tira un error para cancelar.
export async function updateFile(
  path: string,
  update: (current: string | null) => string,
  message: string,
): Promise<{ commitUrl: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const current = await getFile(path);
    const text = update(current?.text ?? null);
    const res = await github(`/repos/${repo()}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({ message, content: Buffer.from(text, "utf8").toString("base64"), sha: current?.sha }),
    });
    if (res.ok) {
      const { commit } = (await res.json()) as { commit: { html_url: string } };
      return { commitUrl: commit.html_url };
    }
    if (res.status !== 409 || attempt === 2) {
      throw new Error(`GitHub rechazó el cambio en ${path} (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
  }
  throw new Error(`No se pudo guardar ${path}`);
}

// Usuario dueño del GITHUB_TOKEN: queda como responsable en los commits y en epics.json.
let login: string | undefined;
export async function currentUser(): Promise<string> {
  if (login) return login;
  const res = await github("/user");
  if (!res.ok) throw new Error(`No se pudo identificar al usuario de GITHUB_TOKEN (${res.status})`);
  login = ((await res.json()) as { login: string }).login;
  return login;
}
