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
    <>
      <header className="sticky top-0 z-40 bg-surface-brand text-on-brand">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 md:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático del design system */}
          <img src="/flock-logo-white.svg" alt="Flock" width={101} height={26} className="h-6.5 w-auto" />
          <span className="h-6 w-px bg-white/30" aria-hidden="true" />
          <span className="font-heading text-base">Wiki viva</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-8">
        <div className="mb-8">
          <h1 className="font-heading text-[28px] leading-8 font-semibold">Glosario de negocio</h1>
          <p className="mt-1 text-ink-muted">Terminología y casos especiales, por épica</p>
        </div>

        {notice && (
          <p className="mb-6 rounded-[10px] bg-warning-subtle px-4 py-3 text-sm text-warning">{notice}</p>
        )}

        {!glossaries ? (
          <p className="text-danger">No pudimos cargar el glosario. Probá de nuevo en unos minutos.</p>
        ) : epics.every((e) => e.terms.length === 0) ? (
          <p className="text-ink-muted">Todavía no hay términos en el glosario.</p>
        ) : (
          <GlossarySearch epics={epics} jiraBaseUrl={jiraBaseUrl} />
        )}
      </main>
    </>
  );
}
