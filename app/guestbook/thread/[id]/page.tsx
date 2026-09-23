import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import SiteChrome from "@/components/layout/SiteChrome";
import { getSiteHome } from "@/features/site/server/data";
import { GuestbookSharedThread } from "@/features/guestbook/components/GuestbookSharedThread";
import { getPublicGuestbookReply, getPublicGuestbookReplies, getPublicGuestbookThread } from "@/features/guestbook/server/thread";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reply?: string | string[] }>;
};

async function publicOrigin() {
  const configured = process.env.GUESTBOOK_PUBLIC_ORIGIN;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:") return url.origin;
    } catch {
      // Use the validated request host below when configuration is malformed.
    }
  }
  const requestHeaders = await headers();
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (["www.marchgroup.net", "marchgroup.net", "www-dev.marchgroup.net"].includes(host)) {
    return `https://${host}`;
  }
  return "https://www.marchgroup.net";
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const replyId = Array.isArray(query.reply) ? query.reply[0] : query.reply;
  const thread = await getPublicGuestbookThread(id);
  const preview = thread && replyId ? await getPublicGuestbookReply(id, replyId) || thread : thread;
  const origin = await publicOrigin();
  const path = `/guestbook/thread/${encodeURIComponent(id)}${replyId ? `?reply=${encodeURIComponent(replyId)}` : ""}`;
  const title = preview && preview.id !== thread?.id
    ? `${preview.displayName} 的回覆｜AFTERGLOW 留言板`
    : thread
      ? `${thread.displayName} 的留言｜AFTERGLOW`
      : "AFTERGLOW 留言板";
  const description = preview?.content.replace(/\s+/g, " ").trim().slice(0, 180)
    || "在清醒夢 AFTERGLOW 留下一段旅人留言。";
  const url = new URL(path, origin).toString();
  const image = new URL("/og.png", origin).toString();

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: "AFTERGLOW 清醒夢留言板" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function GuestbookSharedPage({ params, searchParams }: PageProps) {
  const [{ id }, query, home] = await Promise.all([params, searchParams, Promise.resolve(getSiteHome())]);
  if (home.pageVisibility.guestbook === false) notFound();
  const message = await getPublicGuestbookThread(id);
  if (!message || message.id !== message.threadId) notFound();
  const replyId = Array.isArray(query.reply) ? query.reply[0] : query.reply;
  const initialReplies = replyId ? await getPublicGuestbookReplies(id, replyId) : null;

  return (
    <SiteChrome navigation={home.navigation} shopInfo={home.shopInfo} pageVisibility={home.pageVisibility}>
      <GuestbookSharedThread message={message} targetReplyId={replyId || null} initialReplies={initialReplies} />
    </SiteChrome>
  );
}
