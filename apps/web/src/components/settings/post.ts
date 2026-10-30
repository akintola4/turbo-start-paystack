/** POSTs JSON to one of the app's routes. Never throws: a network failure
 *  is `{ ok: false }` with a sentence for the form. */
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown = {}
): Promise<
  | { ok: true; data: T }
  | { ok: false; status: number; error?: string; message: string }
> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) {
    return {
      ok: false,
      status: 0,
      message:
        "Couldn't reach the server. Check your connection and try again.",
    };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof data.error === "string" ? data.error : undefined,
      message:
        typeof data.message === "string"
          ? data.message
          : res.status === 403
            ? "Your role can't do that here."
            : "That didn't work. Try again in a moment.",
    };
  }
  return { ok: true, data: data as T };
}
