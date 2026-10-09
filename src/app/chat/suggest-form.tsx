"use client";

import { useState } from "react";

type State = { status: "idle" | "saving" } | { status: "done"; name: string; commitUrl: string } | { status: "error"; message: string };

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700";

// Formulario "Agregar al glosario": mismo formato que glossary.md. Guarda con un commit vía /api/suggest.
export function SuggestForm({ term, question, onClose }: { term: string; question: string; onClose: () => void }) {
  const [state, setState] = useState<State>({ status: "idle" });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setState({ status: "saving" });
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, question }),
      });
      const json = (await res.json()) as { error?: string; name?: string; commitUrl?: string };
      if (!res.ok || !json.commitUrl) throw new Error(json.error ?? "No se pudo guardar el término.");
      setState({ status: "done", name: json.name ?? data.name, commitUrl: json.commitUrl });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "No se pudo guardar el término." });
    }
  }

  if (state.status === "done") {
    return (
      <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
        Listo: <strong>{state.name}</strong> se agregó al glosario. Va a aparecer en la wiki y en el chat en ~1 minuto, cuando
        termine el redeploy.{" "}
        <a href={state.commitUrl} target="_blank" rel="noreferrer" className="underline">
          Ver el cambio
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Agregar al glosario</h2>
        <button type="button" onClick={onClose} className="text-sm text-neutral-500 hover:underline">
          Cancelar
        </button>
      </div>
      <label className="block text-sm">
        Término *
        <input name="name" defaultValue={term} required minLength={2} maxLength={100} className={inputClass} />
      </label>
      <label className="block text-sm">
        Siglas / sinónimos <span className="text-neutral-500">(separados por coma)</span>
        <input name="synonyms" className={inputClass} />
      </label>
      <label className="block text-sm">
        Definición * <span className="text-neutral-500">(una o dos oraciones)</span>
        <textarea name="definition" required minLength={10} rows={3} className={inputClass} />
      </label>
      <label className="block text-sm">
        Casos especiales
        <textarea name="specialCases" rows={2} className={inputClass} />
      </label>
      <label className="block text-sm">
        Fuentes <span className="text-neutral-500">(claves de Jira separadas por coma)</span>
        <input name="sources" placeholder="ABC-123, ABC-456" className={inputClass} />
      </label>
      {state.status === "error" && <p className="text-sm text-red-700 dark:text-red-300">{state.message}</p>}
      <button
        type="submit"
        disabled={state.status === "saving"}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {state.status === "saving" ? "Guardando…" : "Guardar en el glosario"}
      </button>
    </form>
  );
}
