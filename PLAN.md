# Plan del MVP

Cada fase termina con un criterio de "listo" verificable. Marcar las tareas al completarlas.

## Fase 0 — Base del proyecto

- [x] Proyecto Next.js con TypeScript, Tailwind, ESLint y App Router (`create-next-app` ya hace `git init` y el primer commit; si el proyecto se creó de otra forma, correr `git init`).
- [x] Verificar que `.gitignore` excluya `.env*` (salvo `.env.example`), `node_modules`, `.next` y `.vercel`.
- [x] Instalar `ai zod @openrouter/ai-sdk-provider` y `tsx` como dev dependency.
- [x] Crear `src/lib/model.ts` con `getModel()` leyendo `LLM_PROVIDER`, `LLM_MODEL` y `OPENROUTER_API_KEY`.
- [x] Crear `.env.example` con todas las variables de `CLAUDE.md`, sin valores.
- [x] `src/proxy.ts` con basic auth usando `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD` (Next 16 renombró `middleware.ts` a `proxy.ts`).
- [x] Commit: `chore: base del proyecto`.
- [x] Crear el repo en GitHub (privado), agregar el remoto y hacer push de `main`. Con GitHub CLI: `gh repo create wiki-viva --private --source=. --push`.
- [x] Vincular con Vercel: `vercel link` o importar el repo desde el panel de Vercel.
- [x] Cargar las variables de entorno en Vercel (`vercel env add` o desde el panel).
- [x] Verificar que cada push a `main` dispare un deploy automático.

**Listo cuando:** `npm run build` pasa, el repo está en GitHub y el deploy en Vercel pide usuario y contraseña.

Convención para el resto del día: un commit al cerrar cada fase (`feat: conector de Jira`, `feat: página wiki`, etc.), así cada fase queda deployada y se puede volver atrás si algo se rompe.

## Fase 1 — Conector de Jira

- [x] `src/connectors/types.ts` con `SourceDoc` y `SourceConnector`.
- [x] `src/connectors/jira.ts`, con un tipo interno `JiraIssue` y su conversión a `SourceDoc`.
- [x] Datos que debe leer de cada tarjeta:
  - Número de tarjeta (`key`, ej: ABC-123).
  - Tipo de tarjeta (`issuetype.name`): épica, historia, subtarea, bug y bug test.
  - Título (`summary`), descripción (`description`) y estado (`status.name`).
  - Tarjeta padre (`parent.key`), para saber de qué historia es cada subtarea.
  - Comentarios completos: autor, fecha y texto de cada uno.
  - Última fecha de actualización (`updated`).
- [x] Alcance de `sync()`, en tres pasos (una sola consulta `parent = ÉPICA` NO trae las subtareas, porque su padre es la historia, no la épica):
  1. La épica misma (`key = JIRA_EPIC_KEY`).
  2. Sus hijos directos con `JIRA_EPIC_JQL`: historias, bugs y bug tests.
  3. Las subtareas de esos hijos: `parent in (CLAVE-1, CLAVE-2, ...)`, en lotes de hasta 50 claves.
- [x] Usar `/rest/api/3/search/jql` paginando con `nextPageToken`, pidiendo solo los campos de arriba.
- [x] Comentarios: el campo `comment` de la búsqueda puede venir truncado. Si `comment.total` es mayor que la cantidad recibida, traer el resto con `/rest/api/3/issue/{key}/comment`, paginado.
- [x] Tipos de tarjeta: los nombres dependen del idioma y la configuración de Jira (ej: "Historia", "Subtarea", "Error", o un tipo personalizado "Bug Test"). No hardcodear nombres: normalizar con un mapa configurable en `jira.ts` (`epic`, `story`, `subtask`, `bug`, `bug_test`) y conservar el nombre original. Un tipo desconocido se guarda con su nombre original, no se descarta.
- [x] Convertir descripción y comentarios (formato ADF) a texto plano o markdown simple.
- [x] Formato del `content` de cada tarjeta, pensado para que el LLM lo lea y cite:

```markdown
### ABC-123 · Historia · En curso · actualizada 2026-10-05
Padre: ABC-100
**Título:** ...
**Descripción:** ...
**Comentarios:**
- 2026-10-03 · Ana Pérez: ...
- 2026-10-04 · Juan Gómez: ...
```

- [x] Devolver un `SourceDoc` por tarjeta con `url = JIRA_BASE_URL/browse/KEY`.
- [x] `src/connectors/registry.ts` exportando la lista de conectores activos (hoy solo Jira).
- [x] `src/lib/context.ts`: arma un único markdown con todos los docs y lo cachea en memoria 10 minutos. Loguea el tamaño aproximado en tokens (caracteres / 4).

**Listo cuando:** un script de prueba imprime la cantidad de tarjetas por tipo (épica, historias, subtareas, bugs, bug tests), la cantidad total de comentarios, la fecha de actualización más reciente y el tamaño del snapshot en tokens aproximados.

## Fase 2 — Extracción

- [x] Prompt de extracción en `src/lib/prompts.ts`. Pide términos de negocio, siglas, sinónimos y casos especiales, cada uno con los issues donde aparece. Prohíbe inventar definiciones no sustentadas.
- [x] `scripts/extract.ts`: corre `sync()`, llama al LLM con `generateText` y escribe `glossary.draft.md`.
- [x] Si el snapshot es demasiado grande para el modelo, procesar por lotes de issues y fusionar términos duplicados en una segunda llamada.

Formato de cada término en el glosario:

```markdown
## Nombre del término
**Siglas / sinónimos:** ...
**Definición:** una o dos oraciones.
**Casos especiales:** excepciones o reglas particulares, si las hay.
**Fuentes:** ABC-123, ABC-145
```

**Listo cuando:** existe `glossary.draft.md` con términos en ese formato.

## Fase 3 — Revisión humana

- [x] Revisar el borrador a mano, corregir, borrar lo dudoso y guardarlo como `glossary.md`.
- [x] Commit y push.

**Checkpoint:** si la extracción salió floja, no reintentar. Corregir a mano los 20 términos más importantes y seguir.

## Fase 4 — Página wiki

- [x] `src/app/page.tsx` lee `glossary.md` en el servidor y lo parsea por secciones `##`.
- [x] Lista de términos con buscador del lado del cliente (filtra por nombre, siglas y definición).
- [x] Las claves de issue en "Fuentes" se muestran como links a Jira.
- [x] Link visible al chat.

**Listo cuando:** la wiki está online en Vercel y la búsqueda funciona. Este ya es un entregable por sí solo.

## Fase 5 — API y UI de chat

- [x] `src/app/api/chat/route.ts` con `streamText` y `getModel()`.
- [x] System prompt: glosario completo + snapshot de la épica + reglas (responder solo con esas fuentes, citar claves de issue, decir "no lo sé" si no está).
- [x] `src/app/chat/page.tsx` con `useChat` del AI SDK, streaming y estado de carga.
- [x] Manejo de errores: si falla Jira o el LLM, mensaje claro en la UI.

**Listo cuando:** el chat responde con streaming una pregunta sobre un término del glosario.

## Fase 6 — Citas y ciclo vivo

- [x] `src/lib/citations.ts`: detecta claves con `/\b[A-Z][A-Z0-9]+-\d+\b/` y las convierte en links a Jira en los mensajes del chat.
- [x] Cuando el modelo no encuentra un término, la respuesta incluye un marcador (ej: `[SIN_DATOS: término]`) y la UI muestra un botón "Agregar al glosario".
- [x] El botón abre un formulario con el término precargado para completar sinónimos, definición, casos especiales y fuentes (mismo formato que el glosario).
- [x] `src/app/api/suggest/route.ts`: recibe el término completo y lo agrega al final de `glossary.md` en el repo privado de datos con un commit vía la API de GitHub (`GITHUB_TOKEN`, `GLOSSARY_REPO`), e invalida la caché del glosario: el término aparece al instante en la wiki y el chat.
- [x] Glosario fuera del repo público: `glossary.md` vive en el repo privado `GLOSSARY_REPO`; este repo tiene `glossary.example.md` con datos ficticios.

**Listo cuando:** una pregunta sin respuesta termina en un término nuevo en `glossary.md` (repo privado), visible en la wiki.

**Checkpoint:** al cerrar esta fase se congela la funcionalidad; desde acá solo se arreglan bugs.

## Fase 7 — Validación

- [ ] Probar con las 15 a 20 preguntas reales anotadas la noche anterior.
- [ ] Ajustar el system prompt según los errores encontrados.
- [ ] Verificar que ninguna respuesta invente datos sin cita.

## Fase 8 — Deploy final

- [ ] Cargar todas las variables de entorno en Vercel.
- [ ] `npm run build` local sin errores y deploy a producción.
- [ ] Probar wiki, chat y sugerencia en la URL de producción.
