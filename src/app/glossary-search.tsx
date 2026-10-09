"use client";

import { useMemo, useState } from "react";
import type { GlossaryTerm } from "@/lib/glossary";

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

export function GlossarySearch({ terms, jiraBaseUrl }: { terms: GlossaryTerm[]; jiraBaseUrl: string }) {
  const [query, setQuery] = useState("");

  const indexed = useMemo(
    () => terms.map((t) => ({ term: t, haystack: normalize([t.name, ...t.synonyms, t.definition].join(" ")) })),
    [terms],
  );
  const q = normalize(query.trim());
  const results = q ? indexed.filter((i) => i.haystack.includes(q)).map((i) => i.term) : terms;

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por término, sigla o definición…"
        autoFocus
        className="w-full rounded-lg border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-500 dark:border-neutral-700"
      />
      <p className="mt-2 mb-6 text-sm text-neutral-500">
        {results.length} de {terms.length} términos
      </p>

      <ul className="space-y-4">
        {results.map((t) => (
          <li key={t.slug} id={t.slug} className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
            <h2 className="text-lg font-semibold">
              <a href={`#${t.slug}`} className="hover:underline">
                {t.name}
              </a>
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
