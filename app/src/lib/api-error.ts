// Turns a failed API reply into a message a person can act on.
// 429 = too many requests (server sends Retry-After seconds), 503 = an outside API is busy.
export async function friendlyError(res: Response): Promise<string> {
  const body: { error?: string } = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After"));
    return `Too many requests right now. Try again in ${wait > 0 ? `${wait} seconds` : "a minute"}.`;
  }
  if (res.status === 503) return body.error ?? "That service is busy. Try again in a few seconds.";
  return body.error ?? `Something went wrong (HTTP ${res.status}). Try again.`;
}
