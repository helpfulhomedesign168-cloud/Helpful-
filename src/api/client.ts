export const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api/v1";

const responseCache = new Map<string, { expires: number; data: unknown }>();
const CACHE_TTL_MS = 15_000;

export function clearApiCache() {
  responseCache.clear();
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const cacheKey = `${token ?? ""}|${path}`;
  if (method === "GET") {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.data as T;
  } else {
    responseCache.clear();
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? "API_ERROR",
      body?.error?.message ?? "伺服器未能完成請求。",
    );
  }
  if (method === "GET") {
    responseCache.set(cacheKey, {
      expires: Date.now() + CACHE_TTL_MS,
      data: body,
    });
  }
  return body as T;
}

export type InvoiceSummary = {
  id: string;
  number: string;
  status: string;
  categories: string[];
  totalCents: number;
  validPaidCents: number;
  salesName: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string;
};

export type InvoiceDetailData = InvoiceSummary & {
  currentVersion: number;
  supervisorName: string | null;
  grantApplicationNumber: string | null;
  grantApprovedAmountCents: number | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    whatsapp: string | null;
    address: string | null;
    district: string | null;
  };
  lines: {
    id: string;
    name: string;
    position: string | null;
    quantity: string;
    unit: string;
    unitPriceCents: number;
    amountCents: number;
  }[];
  version: { id: string; versionNo: number; reason: string | null; createdAt: string };
};

export type ApiPayment = {
  id: string;
  installment: number;
  amountCents: number;
  method: string;
  status: string;
  paidAt: string;
  reference: string | null;
  notes: string | null;
  proofFilename?: string | null;
  proofUrl?: string | null;
};

export async function apiUpload<T>(
  path: string,
  token: string | null,
  formData: FormData,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  const body = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.error?.code ?? "API_ERROR",
      body?.error?.message ?? "上載失敗。",
    );
  }
  responseCache.clear();
  return body as T;
}
