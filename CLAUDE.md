# Wiki viva de terminología

Glosario de negocio por épica de Jira, para resolver dudas de terminología y casos especiales sin tener que preguntarle a un compañero. Deploy en Vercel.

Los mantenedores arman cada glosario conversando con su propio Claude a través de un **MCP local** (`mcp/server.ts`), en su PC y con VPN: Claude lee la épica, propone términos, los revisa con la persona y los publica en un **repo privado de datos** (`GLOSSARY_REPO`) como `glossaries/<ÉPICA>.md`. Este repo es público y nunca contiene glosarios reales. El sitio desplegado es una wiki de **solo lectura** de esos glosarios.

El plan de trabajo está en `PLAN.md`. Marcá cada tarea al terminarla.

## Stack

- Next.js (App Router, Cache Components) + TypeScript estricto + Tailwind, deploy en Vercel.
- MCP TypeScript SDK (`@modelcontextprotocol/sdk`) para el servidor local, transporte stdio.
- Jira Cloud vía API REST con API token. Búsqueda con `/rest/api/3/search/jql` (el endpoint viejo `/search` está deprecado).
- Sin LLM en el servidor, sin base de datos, sin agentes ni orquestadores: la IA la pone el Claude de cada mantenedor.

## Arquitectura

```
Jira ──sync(épica)──► MCP local (mantenedor, VPN) ──commits──► repo privado: glossaries/<ÉPICA>.md + epics.json
                                                                       │
                                               API de GitHub + caché ~1 min
                                                                       ▼
                                                           Sitio: wiki de solo lectura
```

Toda fuente de datos implementa esta interfaz. Agregar una fuente = un conector nuevo + una entrada en `src/connectors/registry.ts`:

```ts
export interface SourceDoc {
  id: string;          // ej: "ABC-123"
  title: string;
  url: string;
  type: string;        // normalizado: "epic" | "story" | "subtask" | "bug" | "bug_test" | otro
  parentId?: string;   // ej: la historia de una subtarea
  updatedAt: string;   // ISO 8601
  content: string;     // markdown compacto, incluye descripción y comentarios
  metadata?: Record<string, unknown>; // datos propios de cada fuente (estado, tipo original, etc.)
}

export interface SourceConnector {
  id: string;
  name: string;
  sync(epicKey: string): Promise<SourceDoc[]>;  // trae la épica completa
  titles?(ids: string[]): Promise<Record<string, string>>;  // títulos sueltos, ej: fuentes de otra épica
}
```

## Estructura

```
mcp/server.ts              # MCP local: listar_epicas, estado_epica, leer_epica, leer_glosario,
                           # publicar_glosario, agregar_termino y el prompt armar_glosario
.mcp.json                  # registra el MCP en Claude Code al abrir el repo
src/
  app/
    page.tsx               # wiki: todos los glosarios, con buscador y filtro por épica
    glossary-search.tsx    # buscador y filtro (cliente)
  connectors/
    types.ts               # SourceConnector, SourceDoc
    jira.ts                # sync(épica), solo lectura
    registry.ts            # lista de fuentes activas
  lib/
    glossary.ts            # formato: parseGlossary, formatTerm, validateGlossary (sin dependencias de Next)
    data-repo.ts           # API de contenidos de GitHub sobre GLOSSARY_REPO (sin dependencias de Next)
    load-glossaries.ts     # lectura cacheada de los glosarios para el sitio ("use cache")
    context.ts             # snapshot de una épica, cacheado 10 min por épica
  proxy.ts                 # basic auth + anti-CSRF (ex middleware.ts en Next 16)
scripts/jira-check.ts      # prueba del conector
glossary.example.md        # glosario ficticio, se usa si no hay GLOSSARY_REPO
glossaries/                # copia local opcional de los glosarios reales (gitignored)
```

Repo privado de datos: `glossaries/<ÉPICA>.md` (un `# <ÉPICA> · nombre` y un `## Término` por término), `glossaries/<ÉPICA>.sources.json` (título de cada tarjeta citada en Fuentes, lo escribe el MCP al publicar) y `epics.json` (estado, responsable y fecha por épica).

## Variables de entorno (`.env.local`, nunca commitear)

```
# Sitio (Vercel)
GITHUB_TOKEN=                       # fine-grained, solo GLOSSARY_REPO. Sitio: Contents read. MCP: read/write
GLOSSARY_REPO=owner/wiki-viva-data  # repo privado con glossaries/ y epics.json
JIRA_BASE_URL=https://empresa.atlassian.net   # el sitio solo lo usa para armar links
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=
BASIC_AUTH_USERS=                   # opcional, usuarios extra: "user:pass,user2:pass2"

# MCP local (cada mantenedor las suyas)
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_EPIC_JQL=                      # opcional, con {epic}: por defecto "parent = {epic}"
JIRA_EPIC_KEY=ABC-100               # opcional, épica por defecto de scripts/jira-check.ts
```

## Reglas

- Los secretos solo se usan en código de servidor o en el MCP. Nada de `NEXT_PUBLIC_` para tokens.
- El MCP no tiene IA propia: expone datos y valida. Nunca publica sin que el Claude del mantenedor tenga su OK explícito (lo piden las descripciones de las herramientas y el prompt).
- En el MCP, stdout es el canal del protocolo: loguear siempre a stderr.
- Las claves de épica se validan con `ISSUE_KEY` antes de usarlas en JQL o rutas.
- `publicar_glosario` valida con `validateGlossary` antes de escribir; `agregar_termino` rechaza nombres o sinónimos repetidos.
- Los glosarios reales y cualquier dato de Jira nunca se commitean en este repo (es público): van al repo privado `GLOSSARY_REPO`. Los ejemplos en código y docs usan claves ficticias (`ABC-123`).
- Manejar errores de Jira y GitHub con mensajes claros (en la wiki, sin romper la página; en el MCP, con `isError`).
- Mantener el código simple. No agregar dependencias sin necesidad.
- Ramas: se trabaja y commitea en `dev` (ambiente de preview en Vercel); a producción se pasa mergeando `dev` en `main`. Las demás ramas no se deployan (`vercel.json`).

## Comandos

```
npm run dev                                   # sitio en desarrollo
npm run mcp                                   # MCP por stdio (normalmente lo levanta Claude vía .mcp.json)
npx tsx scripts/jira-check.ts ABC-100         # prueba del conector (--write vuelca snapshot.local.md)
npm run build                                 # verificar antes de deployar
```

## Fuera de alcance

Chat en el sitio, índice vectorial, OAuth por usuario, base de datos, historial. El chat se puede retomar con una key de LLM de la organización (ver `PLAN.md`).
