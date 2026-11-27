import { getEnv, getOptionalEnv } from "./env";

const BUCKET = "work-order-photos";

function storageConfig() {
  const env = getEnv();
  const key = getOptionalEnv().serviceRoleKey;
  if (!key) throw new Error("STORAGE_NOT_CONFIGURED");
  return {
    base: `${env.SUPABASE_URL}/storage/v1`,
    key,
    bucket: BUCKET,
  };
}

export async function uploadWorkOrderPhoto(
  path: string,
  bytes: ArrayBuffer,
  mime: string,
) {
  const { base, key, bucket } = storageConfig();
  const res = await fetch(`${base}/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mime,
      "x-upsert": "false",
    },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
}

export async function signedWorkOrderPhoto(path: string) {
  const { base, key, bucket } = storageConfig();
  const res = await fetch(`${base}/object/sign/${bucket}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Storage sign failed (${res.status})`);
  const body = (await res.json()) as { signedURL?: string };
  if (!body.signedURL) throw new Error("Storage sign returned no URL");
  return `${base}${body.signedURL}`;
}

export async function deleteWorkOrderPhoto(path: string) {
  const { base, key, bucket } = storageConfig();
  const res = await fetch(`${base}/object/${bucket}/${path}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Storage delete failed (${res.status})`);
  }
}


const PAYMENT_BUCKET = "payment-proofs";

export async function uploadPaymentProof(
  path: string,
  bytes: ArrayBuffer,
  mime: string,
) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/${PAYMENT_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mime,
      "x-upsert": "false",
    },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
}

export async function signedPaymentProof(path: string) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/sign/${PAYMENT_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Storage sign failed (${res.status})`);
  const body = (await res.json()) as { signedURL?: string };
  if (!body.signedURL) throw new Error("Storage sign returned no URL");
  return `${base}${body.signedURL}`;
}


export async function deletePaymentProof(path: string) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/${PAYMENT_BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Storage delete failed (${res.status})`);
  }
}

const PRODUCT_STYLE_BUCKET = "product-style-images";

export async function uploadProductStyleImage(
  path: string,
  bytes: ArrayBuffer,
  mime: string,
) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/${PRODUCT_STYLE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mime,
      "x-upsert": "false",
    },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
}

export async function signedProductStyleImage(path: string) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/sign/${PRODUCT_STYLE_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Storage sign failed (${res.status})`);
  const body = (await res.json()) as { signedURL?: string };
  if (!body.signedURL) throw new Error("Storage sign returned no URL");
  return `${base}${body.signedURL}`;
}

export async function deleteProductStyleImage(path: string) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/${PRODUCT_STYLE_BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Storage delete failed (${res.status})`);
  }
}

const SUPPLIER_LOGO_BUCKET = "supplier-logos";

export async function uploadSupplierLogo(
  path: string,
  bytes: ArrayBuffer,
  mime: string,
) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/${SUPPLIER_LOGO_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": mime,
      "x-upsert": "false",
    },
    body: bytes,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
}

export async function signedSupplierLogo(path: string) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/sign/${SUPPLIER_LOGO_BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 3600 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Storage sign failed (${res.status})`);
  const body = (await res.json()) as { signedURL?: string };
  if (!body.signedURL) throw new Error("Storage sign returned no URL");
  return `${base}${body.signedURL}`;
}

export async function deleteSupplierLogo(path: string) {
  const { base, key } = storageConfig();
  const res = await fetch(`${base}/object/${SUPPLIER_LOGO_BUCKET}/${path}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Storage delete failed (${res.status})`);
  }
}
