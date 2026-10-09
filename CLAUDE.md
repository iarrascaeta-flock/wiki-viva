# Wiki viva de terminología

Asistente que responde dudas de terminología y casos especiales del negocio, para no tener que preguntarle a un compañero. MVP de un día, deploy en Vercel.

El LLM extrae un glosario de una épica de Jira, una persona lo revisa y se guarda como `glossary.md` en un **repo privado de datos** (`GLOSSARY_REPO`): este repo es público y nunca contiene el glosario real. Ese glosario alimenta dos salidas: una página wiki navegable y un chat que responde citando issues.

El plan de trabajo paso a paso está en `PLAN.md`. Seguilo en orden y marcá cada tarea al terminarla.

## Stack

- Next.js (App Router) + TypeScript estricto + Tailwind, deploy en Vercel.
- Vercel AI SDK (`ai`) para LLM y streaming.
- LLM vía OpenRouter, siempre a través de `getModel()` en `src/lib/model.ts`. Nunca instanciar un proveedor directamente en otro archivo.
- Jira Cloud vía API REST con API token. Búsqueda con `/rest/api/3/search/jql` (el endpoint viejo `/search` está deprecado).
- Sin base de datos. Sin agentes ni orquestadores.

## Arquitectura

```
Conectores (SourceConnector) → Extracción (script local) → glossary.md (revisado a mano)
                             → API de chat (glosario + snapshot de la épica en contexto)
glossary.md (repo privado, leído vía API de GitHub y cacheado) → Página wiki + API de chat
API de chat → UI de chat con citas → botón "Agregar al glosario" → commit a glossary.md en el repo privado
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
  sync?(): Promise<SourceDoc[]>;        // MVP: Jira trae la épica completa
  getTools?(): Promise<ToolSet>;        // Futuro: consulta en vivo (MCP)
}
```

## Estructura

```
src/
  app/
    page.tsx               # página wiki (lee el glosario)
    chat/page.tsx          # UI del chat
    api/chat/route.ts      # streaming con contexto
    api/suggest/route.ts   # "Agregar al glosario": commit al repo privado + invalida la caché
  connectors/
    types.ts               # SourceConnector, SourceDoc
    jira.ts                # sync() de la épica (solo lectura)
    registry.ts            # lista de fuentes activas
  lib/
    model.ts               # getModel(), selector de proveedor
    prompts.ts             # prompts de extracción y chat
    context.ts             # arma el contexto y cachea el snapshot
    citations.ts           # detecta claves de issue y arma links
  proxy.ts                 # basic auth (ex middleware.ts en Next 16)
scripts/extract.ts         # extracción, corre en local con tsx
glossary.example.md        # glosario ficticio, se usa si no hay GLOSSARY_REPO
glossary.md                # copia local opcional del glosario real (gitignored)
glossary.draft.md          # salida de la extracción (gitignored)
```

## Variables de entorno (`.env.local`, nunca commitear)

```
LLM_PROVIDER=openrouter
LLM_MODEL=                 # id de OpenRouter (proveedor/modelo); lista separada por comas = respaldos en orden
OPENROUTER_API_KEY=
JIRA_BASE_URL=https://empresa.atlassian.net
JIRA_EMAIL=
JIRA_API_TOKEN=
JIRA_EPIC_KEY=ABC-100
JIRA_EPIC_JQL=parent = ABC-100      # o "Epic Link" = ABC-100 en proyectos clásicos
JIRA_PROJECT_KEY=ABC
GITHUB_TOKEN=                       # fine-grained, solo Contents: read/write en GLOSSARY_REPO
GLOSSARY_REPO=owner/wiki-viva-data  # repo privado con glossary.md
BASIC_AUTH_USER=
BASIC_AUTH_PASSWORD=
BASIC_AUTH_USERS=                   # opcional, usuarios extra: "user:pass,user2:pass2"
```

## Reglas

- Los secretos solo se usan en código de servidor. Nada de `NEXT_PUBLIC_` para tokens.
- El chat responde SOLO con el glosario y la épica. Si no encuentra algo, lo dice y ofrece proponerlo al glosario. Nunca inventa.
- Toda respuesta cita la clave del issue de origen (ej: ABC-123) cuando el dato sale de Jira.
- El snapshot de la épica se cachea en memoria con TTL de 10 minutos.
- La extracción escribe en `glossary.draft.md`, nunca directo en `glossary.md`.
- El glosario real y cualquier dato de Jira nunca se commitean en este repo (es público): van al repo privado `GLOSSARY_REPO`. Los ejemplos en código y docs usan claves ficticias (`ABC-123`).
- Manejar errores de Jira y del LLM con mensajes claros en la UI, sin romper la página.
- Mantener el código simple: es un MVP de un día. No agregar dependencias sin necesidad.

## Comandos

```
npm run dev                       # desarrollo
npx tsx scripts/jira-check.ts     # prueba del conector (--write vuelca snapshot.local.md)
npx tsx scripts/extract.ts        # extracción → glossary.draft.md
npm run build                     # verificar antes de deployar
vercel --prod                     # deploy
```

## Fuera de alcance del MVP

App extra por MCP, más épicas, índice vectorial, OAuth por usuario, base de datos, historial de chat. El diseño de conectores ya los contempla; no implementarlos ahora.
