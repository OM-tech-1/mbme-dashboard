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

// ---- shared query-string helper ----

function qs(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") usp.set(k, v);
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

// ---- stats ----

export interface Stats {
  since: string;
  payments_by_state: Record<string, number>;
  approved_amount_minor_by_currency: Record<string, number>;
  outbox_pending: number;
  outbox_dead_lettered: number;
  webhook_signature_failures: number;
  gateway_call_errors: number;
}

export function getStats(window?: string, storeId?: string, mode?: string) {
  return request<Stats>(`/stats${qs({ window, store_id: storeId, mode })}`);
}

// ---- payments ----

export interface PaymentSummary {
  id: string;
  store_id: string;
  merchant_order_ref: string;
  opaque_ref: string;
  amount_minor: number;
  currency: string;
  state: string;
  mode: string;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface PaymentAttempt {
  id: string;
  oid: string;
  state: string;
  gateway_ref: string;
  has_payment_link: boolean;
  link_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransition {
  oid: string;
  from?: string;
  to: string;
  at: string;
}

export interface PaymentDetail {
  payment: PaymentSummary;
  return_path: string;
  attempts: PaymentAttempt[];
  transitions: PaymentTransition[];
}

export interface PaymentFilters {
  store_id?: string;
  state?: string;
  currency?: string;
  mode?: string;
  q?: string;
  from?: string;
  to?: string;
  cursor?: string;
}

export function listPayments(f: PaymentFilters = {}) {
  const { cursor, ...rest } = f;
  return request<{ items: PaymentSummary[]; next_cursor?: string }>(
    `/payments${qs({ ...rest, cursor })}`,
  );
}

export function getPayment(id: string) {
  return request<PaymentDetail>(`/payments/${encodeURIComponent(id)}`);
}

export interface CheckStatusResult {
  intent_id: string;
  oid: string;
  old_state: string;
  new_state: string;
  changed: boolean;
  gateway_ref: string;
}

export function checkPaymentStatus(id: string) {
  return request<CheckStatusResult>(`/payments/${encodeURIComponent(id)}/check-status`, { method: "POST" });
}

// ---- gateway calls ----

export interface GatewayCallSummary {
  id: string;
  oid: string;
  purpose: string;
  mode: string;
  status_code?: number;
  error?: string;
  called_at: string;
}

export interface GatewayCallDetail extends GatewayCallSummary {
  request: unknown;
  response: unknown;
}

export function listGatewayCalls(f: { oid?: string; purpose?: string; mode?: string; errors_only?: string; from?: string; to?: string; cursor?: string } = {}) {
  return request<{ items: GatewayCallSummary[]; next_cursor?: string }>(`/gateway-calls${qs(f)}`);
}

export function getGatewayCall(id: string, reveal = false) {
  return request<GatewayCallDetail>(`/gateway-calls/${encodeURIComponent(id)}${qs({ reveal: reveal ? "true" : undefined })}`);
}

// ---- webhooks ----

export interface WebhookSummary {
  id: string;
  received_at: string;
  signature_valid: boolean;
  oid?: string;
  status?: string;
  processed_at?: string;
  mode: string;
}

export interface WebhookDetail extends WebhookSummary {
  body: unknown;
}

export function listWebhooks(f: { oid?: string; status?: string; mode?: string; invalid_only?: string; from?: string; to?: string; cursor?: string } = {}) {
  return request<{ items: WebhookSummary[]; next_cursor?: string }>(`/webhooks${qs(f)}`);
}

export function getWebhook(id: string, reveal = false) {
  return request<WebhookDetail>(`/webhooks/${encodeURIComponent(id)}${qs({ reveal: reveal ? "true" : undefined })}`);
}

// ---- outbox ----

export interface OutboxItem {
  id: string;
  event_id: string;
  store_id: string;
  event_type: string;
  attempts: number;
  next_attempt_at: string;
  delivered_at?: string;
  dead_lettered: boolean;
  last_error?: string;
  mode: string;
  created_at: string;
  payload?: unknown;
}

export function listOutbox(f: { store_id?: string; mode?: string; dead_lettered?: string; delivered?: string; cursor?: string } = {}) {
  return request<{ items: OutboxItem[]; next_cursor?: string }>(`/outbox${qs(f)}`);
}

export function retryOutbox(id: string) {
  return request<{ status: string }>(`/outbox/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

// ---- audit ----

export interface AuditEntry {
  id: number;
  key_name: string;
  action: string;
  target: string;
  detail: unknown;
  at: string;
}

export function listAudit(cursor?: string) {
  return request<{ items: AuditEntry[]; next_cursor?: string }>(`/audit${qs({ cursor })}`);
}
