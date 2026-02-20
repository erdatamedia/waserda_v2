function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

export async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: unknown; error?: unknown };
    if (typeof data?.message === "string") return data.message;
    if (Array.isArray(data?.message)) return data.message.join(", ");
    if (data?.message) return JSON.stringify(data.message);
    if (data?.error) return String(data.error);
    return `Request failed (${res.status} ${res.statusText})`;
  } catch {
    try {
      const text = await res.text();
      return text || `Request failed (${res.status} ${res.statusText})`;
    } catch {
      return `Request failed (${res.status} ${res.statusText})`;
    }
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${baseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot reach API ${url}: ${reason}`);
  }
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}

export async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot reach API ${url}: ${reason}`);
  }

  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as T;
}
