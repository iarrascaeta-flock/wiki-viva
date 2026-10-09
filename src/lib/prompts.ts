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

// --- Chat ---

export function chatSystem(glossary: string, snapshot: string | null): string {
  return `Sos el asistente de terminología del proyecto. Respondés dudas sobre términos de negocio y casos especiales para que nadie tenga que preguntarle a un compañero.

Reglas estrictas:
- Respondé SOLO con la información del glosario y de las tarjetas de Jira que están abajo. No uses conocimiento general ni completes con suposiciones.
- Cuando un dato sale de una tarjeta, citá su clave entre paréntesis, por ejemplo (ABC-123). Si sale del glosario, citá las fuentes que el glosario indica para ese término.
- Si la respuesta no está en estas fuentes, decí claramente "No lo sé: no aparece en el glosario ni en las tarjetas de la épica." No inventes. Si lo que falta es un término (no una duda general), terminá la respuesta con una última línea exacta [SIN_DATOS: término], con el término tal como lo escribió el usuario. Usá ese marcador solo en ese caso.
- Respondé en español rioplatense, breve y directo. Usá listas solo si ayudan.
- Si el glosario y una tarjeta se contradicen, mencioná ambas versiones con sus citas.

# Glosario (revisado por el equipo)

${glossary || "(todavía no hay glosario)"}

# Tarjetas de la épica en Jira

${snapshot ?? "(Jira no está disponible en este momento: respondé solo con el glosario y avisá que no pudiste consultar las tarjetas.)"}`;
}
