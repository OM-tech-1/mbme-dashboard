// Thin client for the payment module's JWT admin API. See
// docs/admin-jwt-api.md in the mbme-payment-module repo for the contract this
// mirrors exactly — same fields, same error envelope.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

if (!BASE_URL) {
  // Fails loudly at build/run time rather than every request silently 404ing.
  throw new Error("VITE_API_BASE_URL is not set — copy .env.example to .env.local");
}

const TOKEN_KEY = "mbme_admin_token";
const EXPIRES_KEY = "mbme_admin_token_expires_at";

export function getSession(): { token: string; expiresAt: string } | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(EXPIRES_KEY);
  if (!token || !expiresAt) return null;
  if (new Date(expiresAt).getTime() <= Date.now()) {
    clearSession();
    return null;
  }
  return { token, expiresAt };
}

export function setSession(token: string, expiresAt: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, expiresAt);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (session) headers["Authorization"] = `Bearer ${session.token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    clearSession();
    window.location.assign("/login");
    throw new ApiError(401, "unauthorized", "session expired");
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error ?? "error", body.detail ?? res.statusText);
  }
  return body as T;
}

// ---- auth ----

export async function login(username: string, password: string) {
  const res = await request<{ token: string; expires_at: string }>("/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setSession(res.token, res.expires_at);
  return res;
}

// ---- stores ----

export interface StoreView {
  id: string;
  return_origin: string;
  events_url: string;
  path_template: string;
  hmac_secret_fp: string;
  active: boolean;
  mirror_to_store_id?: string;
  created_at: string;
  updated_at: string;
}

export function listStores() {
  return request<{ items: StoreView[] }>("/stores");
}

export function getStore(id: string) {
  return request<StoreView>(`/stores/${encodeURIComponent(id)}`);
}

export interface CreateStoreInput {
  id: string;
  return_origin: string;
  events_url: string;
  path_template?: string;
  hmac_secret?: string;
}

export function createStore(input: CreateStoreInput) {
  return request<{ store: StoreView; hmac_secret: string }>("/stores", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateStoreInput {
  return_origin?: string;
  events_url?: string;
  path_template?: string;
  active?: boolean;
  mirror_to_store_id?: string;
}

export function updateStore(id: string, input: UpdateStoreInput) {
  return request<StoreView>(`/stores/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deactivateStore(id: string) {
  return request<StoreView>(`/stores/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// purgeStore hard-deletes. force=false throws an ApiError (409
// has_payment_history, message includes the count) if the store has payment
// history — the caller is expected to re-prompt and retry with force=true
// rather than pass force=true blindly on the first attempt.
export function purgeStore(id: string, force = false) {
  const qs = force ? "?force=true" : "";
  return request<{ status: string; id: string; orphaned_intents: number }>(
    `/stores/${encodeURIComponent(id)}/purge${qs}`,
    { method: "DELETE" },
  );
}

export function rotateSecret(id: string, secret?: string) {
  return request<{ store_id: string; hmac_secret: string; hmac_secret_fp: string; warning: string }>(
    `/stores/${encodeURIComponent(id)}/rotate-secret`,
    { method: "POST", body: secret ? JSON.stringify({ hmac_secret: secret }) : undefined },
  );
}
