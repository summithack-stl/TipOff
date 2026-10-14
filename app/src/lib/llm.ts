import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { cached } from "@/lib/cache";

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatOptions = { temperature?: number; maxTokens?: number };
// Env var prefix per provider: LLM = text (Groq), VISION = fast image pass, CONFIRM = second opinion (Gemini).
type Provider = "LLM" | "VISION" | "CONFIRM";
const TIMEOUT_MS: Record<Provider, number> = { LLM: 20_000, VISION: 20_000, CONFIRM: 60_000 };

export function llmInfo(): { provider: string; model: string } {
  const baseURL = process.env.LLM_BASE_URL;
  return {
    provider: baseURL ? new URL(baseURL).host : "api.openai.com",
    model: process.env.LLM_MODEL ?? "",
  };
}

async function complete(
  messages: Message[],
  json: boolean,
  opts?: ChatOptions,
  provider: Provider = "LLM",
): Promise<string> {
  const apiKey = process.env[`${provider}_API_KEY`];
  if (!apiKey) throw new Error(`${provider}_API_KEY is not set`);

  const model = process.env[`${provider}_MODEL`];
  if (!model) throw new Error(`${provider}_MODEL is not set`);

  return cached({ model, messages, json, opts }, async () => {
    const client = new OpenAI({
      apiKey,
      baseURL: process.env[`${provider}_BASE_URL`],
      timeout: TIMEOUT_MS[provider],
      maxRetries: 0,
    });
    const request = async () => {
      const result = await client.chat.completions.create({
        model,
        messages,
        ...(json ? { response_format: { type: "json_object" as const } } : {}),
        ...(opts?.temperature === undefined ? {} : { temperature: opts.temperature }),
        ...(opts?.maxTokens === undefined ? {} : { max_tokens: opts.maxTokens }),
      });
      const content = result.choices[0]?.message.content;
      if (content === null || content === undefined) {
        throw new Error("LLM returned no text content");
      }
      return content;
    };

    try {
      return await request();
    } catch (error) {
      if (!(error instanceof OpenAI.APIError) || error.status !== 429) throw error;
      await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
      try {
        return await request();
      } catch (retryError) {
        if (retryError instanceof OpenAI.APIError && retryError.status === 429) {
          const busy = new Error(`${provider} rate limit hit at ${model} after one retry. Wait a minute or set DEMO_CACHE=1.`);
          busy.name = "RateLimitError"; // routes turn this into a 503 "busy" reply
          throw busy;
        }
        throw retryError;
      }
    }
  });
}

export async function chat(messages: Message[], opts?: ChatOptions): Promise<string> {
  return complete(messages, false, opts);
}

export async function chatJSON<T>(messages: Message[], schema: z.ZodType<T>): Promise<T> {
  const content = await complete(messages, true);
  return schema.parse(JSON.parse(content));
}

// One image plus an instruction, answer parsed as JSON and checked with zod.
export async function visionJSON<T>(
  prompt: string,
  imageDataUrl: string,
  schema: z.ZodType<T>,
  provider: "VISION" | "CONFIRM" = "VISION",
): Promise<T> {
  const messages: Message[] = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageDataUrl } },
      ],
    },
  ];
  // Groq's free tier counts max_tokens against a 1000 output-tokens-per-minute cap, so keep it tight.
  const content = await complete(messages, true, { temperature: 0, maxTokens: 600 }, provider);
  return schema.parse(JSON.parse(content));
}
