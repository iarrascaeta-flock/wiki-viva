import { z } from "zod";

// --- Extracción del glosario ---

export const termSchema = z.object({
  name: z.string().describe("Nombre canónico del término, como se usa en el negocio"),
  synonyms: z.array(z.string()).describe("Siglas, abreviaturas y sinónimos que aparecen en las tarjetas"),
  definition: z.string().describe("Una o dos oraciones, sustentadas en el texto de las tarjetas"),
  specialCases: z.string().describe("Excepciones o reglas particulares; vacío si no hay"),
  sources: z.array(z.string()).describe("Claves de las tarjetas donde aparece, ej: ABC-123"),
});

export const glossarySchema = z.object({ terms: z.array(termSchema) });

export type Term = z.infer<typeof termSchema>;

export const EXTRACTION_SYSTEM = `Sos un analista funcional que arma el glosario de negocio de un proyecto a partir de tarjetas de Jira (épica, historias, subtareas, bugs). El glosario es para que una persona nueva entienda la terminología sin tener que preguntarle a un compañero.

Qué extraer:
- Términos de negocio y del dominio (conceptos, entidades, estados, documentos, cálculos, roles).
- Siglas y abreviaturas, con su significado si las tarjetas lo dan.
- Sinónimos: nombres distintos que las tarjetas usan para lo mismo.
- Casos especiales: excepciones, validaciones o reglas particulares asociadas a un término.

Qué NO extraer:
- Palabras genéricas de software o de UI sin significado de negocio propio (botón, modal, tooltip, grilla, pantalla, guardar, endpoint).
- Nombres de personas, links, ni detalles de implementación técnica.

Reglas estrictas:
- Usá SOLO lo que dicen las tarjetas. No completes con conocimiento general: si el texto no permite definir un término, no lo incluyas.
- La definición tiene que poder verificarse leyendo las tarjetas citadas. Si solo hay indicios parciales, definí únicamente lo que se puede sustentar.
- En "sources" poné solo claves de tarjetas (ej: ABC-123) que aparecen en el texto recibido y donde el término se menciona.
- Escribí en español rioplatense neutro, claro y breve.
- No dupliques: si un término aparece con varios nombres, uno es el nombre y los otros van en "synonyms".`;

export function extractionPrompt(batchMarkdown: string): string {
  return `Extraé los términos del glosario de estas tarjetas de Jira:\n\n${batchMarkdown}`;
}

export const mergeGroupsSchema = z.object({
  groups: z.array(
    z.object({
      canonical: z.string().describe("Nombre que queda, tal cual aparece en la lista"),
      duplicates: z.array(z.string()).describe("Otros nombres de la lista que son el mismo concepto"),
    }),
  ),
});

export const MERGE_SYSTEM = `Recibís la lista de términos de un glosario armado por partes, uno por línea con el formato "nombre | sinónimos". Puede haber duplicados: el mismo concepto con nombres distintos, una sigla usada como nombre, variantes en singular/plural o con distinta capitalización.

Tu tarea es agrupar los duplicados:
- Agrupá solo términos que se refieren exactamente al mismo concepto. Ante la duda, no los agrupes.
- Para cada grupo, elegí como "canonical" el nombre más claro y poné los demás en "duplicates".
- Copiá los nombres exactamente como aparecen en la lista.
- Devolvé solo los grupos con duplicados; los términos únicos no se incluyen.`;

export function mergePrompt(terms: Term[]): string {
  const lines = terms.map((t) => `${t.name} | ${t.synonyms.join(", ")}`);
  return `Términos:\n\n${lines.join("\n")}`;
}
