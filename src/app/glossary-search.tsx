"use client";

import { useMemo, useState } from "react";
import type { EpicGlossary } from "@/lib/load-glossaries";

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
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

export function GlossarySearch({ epics, jiraBaseUrl }: { epics: EpicGlossary[]; jiraBaseUrl: string }) {
  const [query, setQuery] = useState("");
  const [epic, setEpic] = useState(""); // "" = todas las épicas

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
  const q = normalize(query.trim());
  const inEpic = epic ? indexed.filter((i) => i.epic === epic) : indexed;
  const results = q ? inEpic.filter((i) => i.haystack.includes(q)) : inEpic;

  return (
    <div>
      {epics.length > 1 && (
        <select
          value={epic}
          onChange={(e) => setEpic(e.target.value)}
          aria-label="Épica"
          className="mb-3 w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-2 dark:border-neutral-700"
        >
          <option value="">Todas las épicas</option>
          {epics.map((e) => (
            <option key={e.key} value={e.key}>
              {e.title}
            </option>
          ))}
        </select>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por término, sigla o definición…"
        autoFocus
        className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-500 dark:border-neutral-700"
      />
      <p className="mt-2 mb-6 text-sm text-neutral-500">
        {results.length} de {inEpic.length} términos
      </p>

      <ul className="space-y-4">
        {results.map(({ term: t, epic: key, id }) => (
          <li key={id} id={id} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">
              <a href={`#${id}`} className="hover:underline">
                {t.name}
              </a>
              {epics.length > 1 && !epic && <span className="ml-2 text-sm font-normal text-neutral-500">{key}</span>}
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
              <p className="mt-3 text-sm text-neutral-500">
                Fuentes:{" "}
                {t.sources.map((key, i) => (
                  <span key={key}>
                    {i > 0 && ", "}
                    <a
                      href={`${jiraBaseUrl}/browse/${key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {key}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
