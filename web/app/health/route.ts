import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/proxyApi";

export async function GET(req: NextRequest) {
  return proxyToApi(req, "/health");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
