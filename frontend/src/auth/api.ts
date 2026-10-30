/*
 * Tiny fetch client for the DealLock backend.
 *
 *  - credentials:"include" on every call so the express-session cookie rides along
 *    (the backend CORS allowlist already permits the dev origin with credentials).
 *  - CSRF: mutating requests need the double-submit token from GET /auth/csrf. We
 *    fetch it lazily, cache it for the session, attach it as X-CSRF-Token, and on a
 *    CSRF rejection refresh once and retry (covers a rotated/expired token).
 *  - Errors surface as ApiError(status, message, code) so callers can branch on the
 *    backend's machine codes (e.g. EMAIL_VERIFICATION_REQUIRED) without string-matching.
 */
const API_BASE =
  ((import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Could not establish a secure session.");
  const data = (await res.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, opts: RequestOptions = {}, retryOnCsrf = true): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (!SAFE_METHODS.has(method)) {
    headers["X-CSRF-Token"] = csrfToken ?? (await fetchCsrfToken());
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON body — leave data null */
    }
  }
  const payload = data as { error?: string; code?: string } | null;

  if (!res.ok) {
    // A stale/missing CSRF token: refresh once and retry the same request.
    if (res.status === 403 && !SAFE_METHODS.has(method) && retryOnCsrf && /csrf/i.test(payload?.error ?? "")) {
      csrfToken = null;
      await fetchCsrfToken();
      return request<T>(path, opts, false);
    }
    throw new ApiError(res.status, payload?.error ?? res.statusText ?? "Request failed", payload?.code);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body }),
};

/* ── Response/payload shapes (mirror backend/src/routes/auth.ts + email.ts) ── */

export interface SessionUser {
  id: string;
  email: string | null;
  emailVerifiedAt: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface WalletRecord {
  id: string;
  address: string;
  label: string | null;
  isPrimary: boolean;
}

export interface SessionResponse {
  user: SessionUser;
  wallets: WalletRecord[];
}

export interface NonceResponse {
  message: string;
  nonceId: string;
}
