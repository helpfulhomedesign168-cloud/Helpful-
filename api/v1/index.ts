import { app } from "./_server.mjs";

export const config = { runtime: "nodejs" };

async function handler(request: Request) {
  const url = new URL(request.url);
  const subpath = (url.searchParams.get("path") ?? "").replace(/^\/+/, "");
  const target = new URL(`/api/v1/${subpath}`, url.origin);
  for (const [key, value] of url.searchParams) {
    if (key !== "path") target.searchParams.append(key, value);
  }
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  return app.fetch(
    new Request(target, {
      method: request.method,
      headers: request.headers,
      body,
    }),
  );
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
