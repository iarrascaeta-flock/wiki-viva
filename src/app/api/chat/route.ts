import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
} from "ai";
import type { ChatMessage } from "@/lib/citations";
import { getSnapshot } from "@/lib/context";
import { loadGlossary } from "@/lib/glossary";
import { getModel } from "@/lib/model";
import { chatSystem } from "@/lib/prompts";

// El contexto es grande (glosario + épica) y los modelos gratis pueden tardar.
export const maxDuration = 300;

function friendlyError(error: unknown): string {
  const e = error as { statusCode?: number; message?: string } | null;
  console.error("[chat] error del LLM:", e?.statusCode, e?.message);
  if (e?.statusCode === 429) return "El modelo está saturado en este momento. Probá de nuevo en un minuto.";
  if (e?.statusCode === 401 || e?.statusCode === 403) return "El servicio del modelo rechazó la credencial. Avisale al equipo.";
  return "No se pudo generar la respuesta. Probá de nuevo en un rato.";
}

export async function POST(req: Request) {
  const { messages }: { messages: ChatMessage[] } = await req.json();

  // Si el glosario no se puede leer, el chat sigue con las tarjetas de Jira.
  let glossary = "";
  try {
    glossary = (await loadGlossary()).markdown;
  } catch (err) {
    console.error("[chat] no se pudo leer el glosario:", err instanceof Error ? err.message : err);
  }

  // Si Jira falla, el chat sigue respondiendo con el glosario.
  let snapshot: string | null = null;
  const issueTitles: Record<string, string> = {};
  try {
    const { markdown, docs } = await getSnapshot();
    snapshot = markdown;
    for (const doc of docs) issueTitles[doc.id] = doc.title;
  } catch (err) {
    console.error("[chat] no se pudo leer Jira:", err instanceof Error ? err.message : err);
  }

  const result = streamText({
    model: getModel({ reasoning: false }),
    instructions: chatSystem(glossary, snapshot),
    messages: await convertToModelMessages(messages),
    // Un poco de temperatura evita que los modelos chicos entren en loop repitiendo citas.
    temperature: 0.3,
    // Tope de largo y penalización por repetición: los modelos gratis tienden a repetirse.
    maxOutputTokens: 1500,
    frequencyPenalty: 0.5,
    // Si el usuario cancela o cierra la página, se deja de generar.
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      onError: friendlyError,
      // Títulos de las tarjetas para mostrarlos junto a las claves citadas.
      messageMetadata: ({ part }) => (part.type === "start" ? { issueTitles } : undefined),
    }),
  });
}
