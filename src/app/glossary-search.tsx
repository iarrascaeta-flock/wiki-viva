"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EpicGlossary } from "@/lib/load-glossaries";

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Nombre de la épica sin la clave del título ("ABC-100 · Facturación" → "Facturación").
function epicName(e: EpicGlossary): string {
  return e.title.replace(/^[A-Z][A-Z0-9]+-\d+\s*·\s*/, "") || e.key;
}

// Markdown mínimo de las definiciones: solo negritas.
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
      )}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}>
      <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function itemClass(selected: boolean): string {
  return `w-full rounded-[14px] px-3 py-2 text-left ${selected ? "bg-selected text-ink" : "text-ink hover:bg-panel-inset"}`;
}

export function GlossarySearch({ epics, jiraBaseUrl }: { epics: EpicGlossary[]; jiraBaseUrl: string }) {
  const [query, setQuery] = useState("");
  const [epic, setEpic] = useState(""); // "" = todas las épicas
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [navOpen, setNavOpen] = useState(false); // índice en pantallas chicas
  const pendingScroll = useRef<string | null>(null);

  const indexed = useMemo(
    () =>
      epics.flatMap((e) =>
        e.terms.map((t) => ({
          term: t,
          epic: e.key,
          id: `${e.key.toLowerCase()}-${t.slug}`,
          haystack: normalize([t.name, ...t.synonyms, t.definition].join(" ")),
        })),
      ),
    [epics],
  );
  const sourceTitles = useMemo(() => Object.fromEntries(epics.map((e) => [e.key, e.sourceTitles])), [epics]);
  const names = useMemo(() => Object.fromEntries(epics.map((e) => [e.key, epicName(e)])), [epics]);

  const q = normalize(query.trim());
  const matching = q ? indexed.filter((i) => i.haystack.includes(q)) : indexed;
  const results = epic ? matching.filter((i) => i.epic === epic) : matching;
  const total = epic ? indexed.filter((i) => i.epic === epic).length : indexed.length;

  // Después de elegir un término en el índice, bajar hasta él cuando ya está en la lista.
  useEffect(() => {
    if (!pendingScroll.current) return;
    document.getElementById(pendingScroll.current)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${pendingScroll.current}`);
    pendingScroll.current = null;
  });

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectEpic(key: string) {
    setEpic(key);
    if (key) setExpanded((prev) => new Set(prev).add(key));
    setNavOpen(false);
  }

  function goToTerm(key: string, id: string) {
    setEpic(key);
    // Si la búsqueda actual oculta el término, se limpia para poder mostrarlo.
    if (!matching.some((i) => i.id === id)) setQuery("");
    pendingScroll.current = id;
    setNavOpen(false);
  }

  return (
    <div className="lg:grid lg:grid-cols-[18rem_1fr] lg:gap-10">
      <button
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        aria-expanded={navOpen}
        className="mb-4 flex h-11 w-full items-center justify-between rounded-full border border-line bg-panel px-5 text-sm text-ink lg:hidden"
      >
        <span>{epic ? names[epic] : "Todas las épicas"}</span>
        <span className="text-ink-muted">Épicas ({epics.length})</span>
      </button>

      <nav
        aria-label="Épicas"
        className={`${navOpen ? "block" : "hidden"} mb-6 rounded-[16px] border border-line bg-panel p-2.5 text-[13.5px] leading-snug shadow-xl shadow-black/30 lg:sticky lg:top-6 lg:mb-0 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto`}
      >
        <button type="button" onClick={() => selectEpic("")} className={itemClass(epic === "")}>
          <span className="font-bold">Todas las épicas</span>
          <span className="ml-1 font-normal opacity-70">({matching.length})</span>
        </button>
        <ul className="mt-2 space-y-1">
          {epics.map((e) => {
            const items = matching.filter((i) => i.epic === e.key);
            const isOpen = expanded.has(e.key);
            return (
              <li key={e.key}>
                <div className="flex items-start gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggle(e.key)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Contraer" : "Expandir"} ${names[e.key]}`}
                    className="mt-2 rounded-full p-1 text-ink-subtle hover:bg-panel-inset hover:text-ink"
                  >
                    <Chevron open={isOpen} />
                  </button>
                  <button type="button" onClick={() => selectEpic(e.key)} className={itemClass(epic === e.key)}>
                    <span className="block font-bold">{names[e.key]}</span>
                    <span className="mt-0.5 block text-xs opacity-60">
                      {e.key} · {items.length} {items.length === 1 ? "término" : "términos"}
                    </span>
                  </button>
                </div>
                {isOpen && (
                  <ul className="mt-0.5 mb-1 ml-4 space-y-0.5 border-l border-line pl-3">
                    {items.map((i) => (
                      <li key={i.id}>
                        <a
                          href={`#${i.id}`}
                          onClick={(ev) => {
                            ev.preventDefault();
                            goToTerm(e.key, i.id);
                          }}
                          className="block rounded-[8px] px-2.5 py-1.5 text-ink-muted hover:bg-panel-inset hover:text-ink"
                        >
                          {i.term.name}
                        </a>
                      </li>
                    ))}
                    {items.length === 0 && <li className="px-2.5 py-1.5 text-ink-subtle">Sin coincidencias</li>}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por término, sigla o definición…"
          autoFocus
          className="h-12 w-full rounded-full border border-line bg-panel px-6 text-[16.5px] text-ink placeholder:text-ink-subtle focus:border-pill"
        />
        <p className="mt-4 mb-4 px-1 text-xs font-bold tracking-[0.12em] text-ink-muted uppercase">
          {results.length} de {total} términos{epic && ` en ${names[epic]}`}
        </p>

        <ul className="space-y-4">
          {results.map(({ term: t, epic: key, id }) => (
            <li key={id} id={id} className="scroll-mt-6 rounded-[16px] border border-line bg-panel p-7 shadow-xl shadow-black/30">
              <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[22px] leading-snug font-bold">
                <a href={`#${id}`} className="hover:underline">
                  {t.name}
                </a>
                {epics.length > 1 && !epic && (
                  <span className="text-xs font-normal tracking-[0.12em] text-ink-subtle uppercase">{names[key]}</span>
                )}
              </h2>
              {t.synonyms.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="También">
                  {t.synonyms.map((s) => (
                    <li key={s} className="rounded-full border border-pill px-3 py-0.5 text-[13px] text-ink">
                      {s}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-[16.5px] text-ink">
                <Inline text={t.definition} />
              </p>
              {t.specialCases && (
                <div className="mt-5 rounded-[12px] bg-panel-inset px-5 py-4 text-[14px] text-ink-muted">
                  <span className="font-bold text-peach">Casos especiales: </span>
                  <Inline text={t.specialCases} />
                </div>
              )}
              {t.sources.length > 0 && (
                // Con muchas fuentes, la lista arranca cerrada para no tapar el resto del término.
                <details open={t.sources.length <= 5} className="mt-5 border-t border-line pt-4 text-[14px] text-ink-muted">
                  <summary className="cursor-pointer text-xs font-bold tracking-[0.12em] text-ink-subtle uppercase">Fuentes ({t.sources.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {t.sources.map((source) => {
                      const title = sourceTitles[key]?.[source];
                      return (
                        <li key={source}>
                          <a
                            href={`${jiraBaseUrl}/browse/${source}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[13px] font-bold text-peach hover:text-ink"
                          >
                            {source}
                          </a>
                          {title && ` · ${title}`}
                        </li>
                      );
                    })}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
