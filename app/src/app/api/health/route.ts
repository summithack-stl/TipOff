import { NextResponse } from "next/server";
import { quotaStatus, rateLimit } from "@/lib/guard";
import { chat, llmInfo } from "@/lib/llm";

// Each check spends a real LLM call, so reuse the last answer for a minute.
let last: { at: number; body: Record<string, unknown> } | undefined;

export async function GET(request: Request) {
  const limited = rateLimit(request, "health", 10);
  if (limited) return limited;
  // Quota is read fresh even on a cached health check: it is the number that moves.
  if (last && Date.now() - last.at < 60_000) return NextResponse.json({ ...last.body, quota: quotaStatus(), cached: true });

  const start = Date.now();
  const { provider, model } = llmInfo();
  // Which image-detection providers are configured (names only, never values), so a deploy can be checked at a glance.
  const vision = {
    fast: Boolean(process.env.VISION_API_KEY && process.env.VISION_MODEL),
    confirm: Boolean(process.env.CONFIRM_API_KEY && process.env.CONFIRM_MODEL),
  };
  let body: Record<string, unknown>;
  try {
    const reply = await chat([{ role: "user", content: "Reply with: pong" }]);
    body = { ok: true, provider, model, vision, reply, ms: Date.now() - start };
  } catch (error: unknown) {
    console.error("health check failed:", error);
    // Config problems (missing key/model) are safe and useful to show; anything else stays in the server log.
    const message = error instanceof Error && error.message.endsWith("is not set") ? error.message : "LLM call failed";
    body = { ok: false, provider, model, vision, error: message, ms: Date.now() - start };
  }
  last = { at: Date.now(), body };
  return NextResponse.json({ ...body, quota: quotaStatus() });
}
