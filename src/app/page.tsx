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
    <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-10 md:px-14">
      <header className="mb-12">
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático del design system */}
        <img src="/flock-wordmark-white.svg" alt="Flock" width={109} height={28} className="h-7 w-auto" />
        <p className="mt-10 text-xs font-bold tracking-[0.12em] text-ink-muted uppercase">Flock | Wiki viva</p>
        <h1 className="mt-3 text-[46px] leading-[1.08] font-extrabold tracking-[-0.01em]">Glosario de negocio</h1>
        <p className="mt-3 text-[16.5px] text-ink-muted">Terminología y casos especiales, por épica.</p>
      </header>

      {notice && (
        <p className="mb-6 rounded-[14px] border border-line bg-panel px-4 py-3 text-[13.5px] text-ink-muted">{notice}</p>
      )}

      {!glossaries ? (
        <p className="text-peach">No pudimos cargar el glosario. Probá de nuevo en unos minutos.</p>
      ) : epics.every((e) => e.terms.length === 0) ? (
        <p className="text-ink-muted">Todavía no hay términos en el glosario.</p>
      ) : (
        <GlossarySearch epics={epics} jiraBaseUrl={jiraBaseUrl} />
      )}
    </main>
  );
}
