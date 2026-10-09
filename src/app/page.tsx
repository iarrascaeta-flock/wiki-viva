import Link from "next/link";
import { loadGlossary } from "@/lib/glossary";
import { GlossarySearch } from "./glossary-search";

export default function WikiPage() {
  const { terms, isDraft } = loadGlossary();
  const jiraBaseUrl = process.env.JIRA_BASE_URL ?? "";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Wiki viva</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Terminología y casos especiales de {process.env.JIRA_EPIC_KEY ?? "la épica"}
          </p>
        </div>
        <Link
          href="/chat"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Preguntarle al chat →
        </Link>
      </header>

      {isDraft && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Mostrando <code>glossary.draft.md</code>: borrador sin revisar (solo en desarrollo).
        </p>
      )}

      {terms.length === 0 ? (
        <p className="text-neutral-500">Todavía no hay términos en el glosario.</p>
      ) : (
        <GlossarySearch terms={terms} jiraBaseUrl={jiraBaseUrl} />
      )}
    </main>
  );
}
