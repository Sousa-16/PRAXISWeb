import { NextRequest, NextResponse } from "next/server";

const apiBase = (process.env.API_PROXY_TARGET || "http://127.0.0.1:8765").replace(/\/$/, "");
const proxySecret = process.env.PRAXIS_PROXY_SECRET || "";

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

/** Forward browser /v1 and /health calls to the FastAPI host with visitor IP. */
export async function proxyToApi(req: NextRequest, apiPath: string): Promise<Response> {
  const url = new URL(req.url);
  const target = `${apiBase}${apiPath}${url.search}`;
  const headers = new Headers();
  const pass = ["content-type", "accept", "cookie", "authorization"];
  for (const name of pass) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }
  headers.set("x-praxis-client-ip", clientIp(req));
  if (proxySecret) headers.set("x-praxis-proxy-secret", proxySecret);

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json(
      { error: "The demo is temporarily unavailable. Try again in a moment." },
      { status: 502 },
    );
  }

  const out = new NextResponse(upstream.body, { status: upstream.status });
  const copy = [
    "content-type",
    "content-disposition",
    "set-cookie",
    "x-praxis-n-trees",
    "x-praxis-n-exported",
  ];
  for (const name of copy) {
    const v = upstream.headers.get(name);
    if (v) out.headers.set(name, v);
  }
  return out;
}
