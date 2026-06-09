// Direct-fetch helpers for the custom admin endpoints the @mercurjs/client
// path-proxy doesn't cover: multipart upload and DELETE. Both rely on the same
// cookie session as `client` (credentials: 'include' → the auto-protected
// /admin/* routes). __BACKEND_URL__ is injected by the dashboard Vite plugin.

declare const __BACKEND_URL__: string;

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return (data && data.message) || `Request failed (${res.status}).`;
  } catch {
    return `Request failed (${res.status}).`;
  }
}

// Upload one image to Medusa's native file route; returns the served URL
// (e.g. http://localhost:9000/static/<file>) to store on the card/pack.
export async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("files", file);

  const res = await fetch(`${__BACKEND_URL__}/admin/uploads`, {
    method: "POST",
    body,
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
  const data = (await res.json()) as { files?: { url?: string }[] };
  const url = data.files?.[0]?.url;
  if (!url) {
    throw new Error("Upload returned no file URL.");
  }
  return url;
}

export async function deleteCard(handle: string): Promise<void> {
  const res = await fetch(
    `${__BACKEND_URL__}/admin/cards/${encodeURIComponent(handle)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
}

export async function deletePack(slug: string): Promise<void> {
  const res = await fetch(
    `${__BACKEND_URL__}/admin/packs/${encodeURIComponent(slug)}`,
    { method: "DELETE", credentials: "include" }
  );
  if (!res.ok) {
    throw new Error(await errorMessage(res));
  }
}
