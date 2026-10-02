import { readPublicStatusPage } from "@/services/status-pages";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = await readPublicStatusPage(slug);
  return Response.json(document ? { data: document } : { error: "Status page not found" }, {
    status: document ? 200 : 404,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" },
  });
}
