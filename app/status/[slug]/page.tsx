import { notFound } from "next/navigation";
import { readPublicStatusPage } from "@/services/status-pages";
import { PublicStatus } from "@/components/status-pages/public-status";
import { Brand } from "@/components/ui/brand";
import "@/components/status-pages/status-pages.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Service status | Guardian",
  robots: { index: false, follow: false },
};
export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const document = await readPublicStatusPage(slug);
  if (!document) notFound();
  // Request-time timestamp in a dynamic Server Component, serialized once for hydration.
  // eslint-disable-next-line react-hooks/purity
  const asOf = Date.now();
  return (
    <main className="public-status">
      <Brand />
      <PublicStatus slug={slug} initial={document} asOf={asOf} />
      <footer className="muted">Powered by Guardian · Times shown in UTC</footer>
    </main>
  );
}
