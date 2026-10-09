"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function Chat() {
  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Chat de terminología</h1>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Volver a la wiki
        </Link>
      </header>

      <div className="flex-1 space-y-4">
        {messages.length === 0 && (
          <p className="text-neutral-500">
            Preguntá por un término o un caso especial, por ejemplo: <em>¿qué es el hecho generador?</em>
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] rounded-2xl bg-neutral-900 px-4 py-2 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "max-w-[95%] whitespace-pre-wrap leading-relaxed"
            }
          >
            {m.parts.map((part, i) => (part.type === "text" ? <span key={i}>{part.text}</span> : null))}
          </div>
        ))}
        {status === "submitted" && (
          <p className="animate-pulse text-sm text-neutral-500">Buscando en el glosario y en Jira…</p>
        )}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error.message || "Ocurrió un error."}{" "}
            <button type="button" onClick={() => regenerate()} className="font-medium underline">
              Reintentar
            </button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="sticky bottom-0 mt-6 flex gap-2 bg-background py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu pregunta…"
          autoFocus
          className="flex-1 rounded-lg border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-500 dark:border-neutral-700"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-lg border border-neutral-400 px-5 py-3 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900"
          >
            Detener
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            Enviar
          </button>
        )}
      </form>
    </main>
  );
}
