import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata():Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "March Group｜店員名鑑";
  const description = "走進清醒夢境，認識 March Group 的每一位店員。";
  return {
    title,
    description,
    icons:{ icon:"/favicon.svg", shortcut:"/favicon.svg" },
    openGraph:{ title, description, type:"website", images:[{ url:`${origin}/og.png`, width:1733, height:909, alt:"March Group Staff Archive" }] },
    twitter:{ card:"summary_large_image", title, description, images:[`${origin}/og.png`] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
