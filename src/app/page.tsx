import { type Glossaries, loadGlossaries } from "@/lib/load-glossaries";
import { GlossarySearch } from "./glossary-search";

const SOURCE_NOTICE: Partial<Record<Glossaries["source"], string>> = {
  example: "Mostrando glossary.example.md: glosario de ejemplo con datos ficticios. Configurá GLOSSARY_REPO para usar el real.",
};

export default async function WikiPage() {
  let glossaries: Glossaries | null = null;
  try {
    glossaries = await loadGlossaries();
  } catch (err) {
    console.error("[wiki]", err instanceof Error ? err.message : err);
  }
  const epics = glossaries?.epics ?? [];
  const notice = glossaries ? SOURCE_NOTICE[glossaries.source] : undefined;
  const jiraBaseUrl = process.env.JIRA_BASE_URL ?? "";

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Wiki viva</h1>
        <p className="mt-1 text-sm text-neutral-500">Terminología y casos especiales del negocio, por épica</p>
      </header>

      {notice && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          {notice}
        </p>
      )}

      {!glossaries ? (
        <p className="text-red-700 dark:text-red-300">No se pudo cargar el glosario. Probá de nuevo en unos minutos.</p>
      ) : epics.every((e) => e.terms.length === 0) ? (
        <p className="text-neutral-500">Todavía no hay términos en el glosario.</p>
      ) : (
        <GlossarySearch epics={epics} jiraBaseUrl={jiraBaseUrl} />
      )}
    </main>
  );
}
