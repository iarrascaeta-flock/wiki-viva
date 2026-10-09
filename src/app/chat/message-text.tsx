import { issueUrl, splitCitations } from "@/lib/citations";

// Texto de una respuesta: negritas simples y claves de Jira como links.
export function MessageText({ text, jiraBaseUrl, projectKey }: { text: string; jiraBaseUrl: string; projectKey?: string }) {
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
