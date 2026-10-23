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
  return `w-full rounded-md px-2 py-1.5 text-left ${
    selected
      ? "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
      : "text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
  }`;
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
    <div className="lg:grid lg:grid-cols-[18rem_1fr] lg:gap-8">
      <button
        type="button"
        onClick={() => setNavOpen((o) => !o)}
        aria-expanded={navOpen}
        className="mb-4 flex w-full items-center justify-between rounded-lg border border-neutral-300 px-4 py-2 text-neutral-800 lg:hidden dark:border-neutral-700 dark:text-neutral-200"
      >
        <span>{epic ? names[epic] : "Todas las épicas"}</span>
        <span className="text-sm text-neutral-500">Épicas ({epics.length})</span>
      </button>

      <nav
        aria-label="Épicas"
        className={`${navOpen ? "block" : "hidden"} mb-6 text-sm lg:sticky lg:top-6 lg:mb-0 lg:block lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto`}
      >
        <button type="button" onClick={() => selectEpic("")} className={itemClass(epic === "")}>
          <span className="font-medium">Todas las épicas</span>
          <span className="ml-1 text-neutral-500">({matching.length})</span>
        </button>
        <ul className="mt-1 space-y-0.5">
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
                    className="mt-1.5 rounded p-0.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  >
                    <Chevron open={isOpen} />
                  </button>
                  <button type="button" onClick={() => selectEpic(e.key)} className={itemClass(epic === e.key)}>
                    <span className="block font-medium leading-snug">{names[e.key]}</span>
                    <span className="block text-xs text-neutral-500">
                      {e.key} · {items.length} {items.length === 1 ? "término" : "términos"}
                    </span>
                  </button>
                </div>
                {isOpen && (
                  <ul className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l border-neutral-200 pl-3 dark:border-neutral-800">
                    {items.map((i) => (
                      <li key={i.id}>
                        <a
                          href={`#${i.id}`}
                          onClick={(ev) => {
                            ev.preventDefault();
                            goToTerm(e.key, i.id);
                          }}
                          className="block rounded px-2 py-1 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                        >
                          {i.term.name}
                        </a>
                      </li>
                    ))}
                    {items.length === 0 && <li className="px-2 py-1 text-neutral-500">Sin coincidencias</li>}
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
          className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        <p className="mt-2 mb-6 text-sm text-neutral-500">
          {results.length} de {total} términos{epic && ` en ${names[epic]}`}
        </p>

        <ul className="space-y-4">
          {results.map(({ term: t, epic: key, id }) => (
            <li key={id} id={id} className="scroll-mt-6 rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
              <h2 className="text-lg font-semibold">
                <a href={`#${id}`} className="hover:underline">
                  {t.name}
                </a>
                {epics.length > 1 && !epic && (
                  <span className="ml-2 text-sm font-normal text-neutral-500">{names[key]}</span>
                )}
              </h2>
              {t.synonyms.length > 0 && (
                <p className="mt-1 text-sm text-neutral-500">También: {t.synonyms.join(", ")}</p>
              )}
              <p className="mt-3 leading-relaxed">
                <Inline text={t.definition} />
              </p>
              {t.specialCases && (
                <div className="mt-3 rounded-md bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-900">
                  <span className="font-medium">Casos especiales: </span>
                  <Inline text={t.specialCases} />
                </div>
              )}
              {t.sources.length > 0 && (
                // Con muchas fuentes, la lista arranca cerrada para no tapar el resto del término.
                <details open={t.sources.length <= 5} className="mt-3 text-sm text-neutral-500">
                  <summary className="cursor-pointer">Fuentes ({t.sources.length})</summary>
                  <ul className="mt-1 space-y-0.5">
                    {t.sources.map((source) => {
                      const title = sourceTitles[key]?.[source];
                      return (
                        <li key={source}>
                          <a
                            href={`${jiraBaseUrl}/browse/${source}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline dark:text-blue-400"
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
