import { connection } from "next/server";
import { Suspense } from "react";
import { Chat } from "./chat";

// useChat genera ids aleatorios al renderizar: con Cache Components hay que diferir el render
// a cada request en vez de prerenderizarlo en el build.
async function ChatAtRequestTime() {
  await connection();
  return <Chat />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 text-neutral-500">Cargando…</main>}>
      <ChatAtRequestTime />
    </Suspense>
  );
}
