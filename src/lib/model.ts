import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

// Único punto donde se instancia un proveedor de LLM.
export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "openrouter";
  const modelId = process.env.LLM_MODEL;
  if (!modelId) throw new Error("Falta la variable de entorno LLM_MODEL");

  switch (provider) {
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("Falta la variable de entorno OPENROUTER_API_KEY");
      return createOpenRouter({ apiKey })(modelId);
    }
    default:
      throw new Error(`LLM_PROVIDER no soportado: ${provider}`);
  }
}
