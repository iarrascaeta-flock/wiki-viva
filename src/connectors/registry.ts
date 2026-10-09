import { jiraConnector } from "./jira";
import type { SourceConnector } from "./types";

// Fuentes activas. Agregar una fuente = un conector nuevo + una entrada acá.
export const connectors: SourceConnector[] = [jiraConnector];
