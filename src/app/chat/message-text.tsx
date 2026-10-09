import { citedKeys, issueUrl, splitCitations } from "@/lib/citations";

interface Props {
  text: string;
  jiraBaseUrl: string;
  projectKey?: string;
  issueTitles?: Record<string, string>;
}

// Texto de una respuesta: negritas simples y claves de Jira como links (con el título de la tarjeta al pasar el mouse).
export function MessageText({ text, jiraBaseUrl, projectKey, issueTitles }: Props) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) => {
        const bold = chunk.startsWith("**") && chunk.endsWith("**");
        const content = splitCitations(bold ? chunk.slice(2, -2) : chunk, projectKey).map((seg, j) =>
          seg.type === "issue" && jiraBaseUrl ? (
            <a
              key={j}
              href={issueUrl(jiraBaseUrl, seg.key)}
              target="_blank"
              rel="noreferrer"
              title={issueTitles?.[seg.key]}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {seg.key}
            </a>
          ) : (
            <span key={j}>{seg.type === "issue" ? seg.key : seg.value}</span>
          ),
        );
        return bold ? <strong key={i}>{content}</strong> : <span key={i}>{content}</span>;
      })}
    </>
  );
}

// Lista de tarjetas citadas en la respuesta, con su título.
export function MessageSources({ text, jiraBaseUrl, projectKey, issueTitles }: Props) {
  const keys = citedKeys(text, projectKey);
  if (keys.length === 0 || !jiraBaseUrl) return null;
  return (
    <div className="border-t border-neutral-200 pt-2 text-sm dark:border-neutral-800">
      <p className="mb-1 font-medium text-neutral-500">Fuentes</p>
      <ul className="space-y-1">
        {keys.map((key) => (
          <li key={key}>
            <a
              href={issueUrl(jiraBaseUrl, key)}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {key}
            </a>
            {issueTitles?.[key] && <span className="text-neutral-600 dark:text-neutral-400"> · {issueTitles[key]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
