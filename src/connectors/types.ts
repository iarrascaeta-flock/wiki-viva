import type { ToolSet } from "ai";

export interface SourceDoc {
  id: string; // ej: "ABC-123"
  title: string;
  url: string;
  type: string; // normalizado: "epic" | "story" | "subtask" | "bug" | "bug_test" | otro
  parentId?: string; // ej: la historia de una subtarea
  updatedAt: string; // ISO 8601
  content: string; // markdown compacto, incluye descripción y comentarios
  metadata?: Record<string, unknown>; // datos propios de cada fuente (estado, tipo original, etc.)
}

export interface SourceConnector {
  id: string;
  name: string;
  sync?(): Promise<SourceDoc[]>; // MVP: Jira trae la épica completa
  getTools?(): Promise<ToolSet>; // Futuro: consulta en vivo (MCP)
}
