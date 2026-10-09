import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

// Único punto donde se instancia un proveedor de LLM.
// LLM_MODEL acepta una lista separada por comas: el primero es el principal y el resto
// son respaldos que OpenRouter usa si el anterior falla (útil con modelos :free saturados).
export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "openrouter";
  const models = (process.env.LLM_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (models.length === 0) throw new Error("Falta la variable de entorno LLM_MODEL");

  switch (provider) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("Falta la variable de entorno OPENROUTER_API_KEY");
      return createOpenRouter({ apiKey })(models[0], models.length > 1 ? { models } : {});
    }
    default:
      throw new Error(`LLM_PROVIDER no soportado: ${provider}`);
  }
}
