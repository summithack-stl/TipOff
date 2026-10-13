import "server-only";

import OpenAI from "openai";
import { z } from "zod";
import { cached } from "@/lib/cache";

type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatOptions = { temperature?: number; maxTokens?: number };

export function llmInfo(): { provider: string; model: string } {
  const baseURL = process.env.LLM_BASE_URL;
  return {
    provider: baseURL ? new URL(baseURL).host : "api.openai.com",
    model: process.env.LLM_MODEL ?? "",
  };
}

async function complete(messages: Message[], json: boolean, opts?: ChatOptions): Promise<string> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not set");

  const model = process.env.LLM_MODEL;
  if (!model) throw new Error("LLM_MODEL is not set");

  return cached({ model, messages, json, opts }, async () => {
    const client = new OpenAI({
      apiKey,
      baseURL: process.env.LLM_BASE_URL,
      timeout: 20_000,
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
          throw new Error(
            `LLM rate limit hit at ${llmInfo().provider} after one retry. Wait a minute, switch keys, or set DEMO_CACHE=1.`,
          );
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
