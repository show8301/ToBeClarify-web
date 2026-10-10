import type { Metadata } from "next";
import DesignatedPreview from "@/features/admin/designated-preview/DesignatedPreview";
import { isPreviewVariant } from "@/features/admin/designated-preview/preview-data";
import "@/styles/admin/designated-preview.css";

export const metadata: Metadata = {
  title: "指名人員工作台｜設計預覽",
  robots: { index: false, follow: false },
};

export default async function DesignatedPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const variant = isPreviewVariant(query.view) ? query.view : "tasks";
  return <DesignatedPreview initialVariant={variant} />;
}
