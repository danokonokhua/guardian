import { jsonResponse } from "@/lib/api";
import { getOpenApiSpecification } from "@/lib/api/openapi";

export async function GET(): Promise<Response> {
  const spec = getOpenApiSpecification();
  return jsonResponse(spec, 200, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=3600",
  });
}
