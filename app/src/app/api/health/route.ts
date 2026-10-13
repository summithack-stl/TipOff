import { NextResponse } from "next/server";
import { chat, llmInfo } from "@/lib/llm";

export async function GET() {
  const start = Date.now();

  try {
    const reply = await chat([{ role: "user", content: "Reply with: pong" }]);
    const { provider, model } = llmInfo();
    return NextResponse.json({ ok: true, provider, model, reply, ms: Date.now() - start });
  } catch (error: unknown) {
    const { provider, model } = llmInfo();
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, provider, model, error: message, ms: Date.now() - start }, { status: 200 });
  }
}
