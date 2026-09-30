import type { TokenResponse } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let accessToken: string | null = null;
let refreshPromise: Promise<TokenResponse | null> | null = null;
let onSessionExpired: (() => void) | null = null;

export const session = {
  setToken(token: string | null) { accessToken = token; },
  onExpired(cb: () => void) { onSessionExpired = cb; },
};

/** Get a new access token using the httpOnly refresh cookie.
 *  Concurrent callers share one request, because a refresh token only works once. */
export function refreshAccessToken(): Promise<TokenResponse | null> {
  refreshPromise ??= fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = (await res.json()) as TokenResponse;
      accessToken = data.access_token;
      return data;
    })
    .catch(() => null)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail)) {
      // FastAPI validation errors: [{loc: [..., "field"], msg: "..."}]
      message = body.detail
        .map((d: { loc: (string | number)[]; msg: string }) => `${d.loc.at(-1)}: ${d.msg}`)
        .join(" · ");
    }
  } catch { /* non-JSON body */ }
  return new ApiError(res.status, message);
}

type ApiInit = Omit<RequestInit, "body"> & { json?: unknown };

export async function api<T>(path: string, init: ApiInit = {}, retry = true): Promise<T> {
  const { json, headers: extra, ...rest } = init;
  const headers = new Headers(extra);
  if (json !== undefined) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`/api${path}`, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
    credentials: "same-origin",
  });

  const isAuthFlow = path === "/auth/login" || path === "/auth/refresh";
  if (res.status === 401 && retry && !isAuthFlow) {
    if (await refreshAccessToken()) return api<T>(path, init, false); // retry once
    accessToken = null;
    onSessionExpired?.();
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}