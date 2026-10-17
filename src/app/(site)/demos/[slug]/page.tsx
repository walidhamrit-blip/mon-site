import { getSiteData } from "@/lib/store";
import { notFound } from "next/navigation";
import { DemoViewer } from "./demo-viewer";

export async function generateStaticParams() {
  const { content } = await getSiteData();
  return content.demos.map((d) => ({ slug: d.slug }));
}

export default async function DemoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { content } = await getSiteData();
  const demo = content.demos.find((d) => d.slug === slug);
  if (!demo) notFound();

  return <DemoViewer demo={demo} allDemos={content.demos} />;
}
