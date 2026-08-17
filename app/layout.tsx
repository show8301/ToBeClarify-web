import type { Metadata } from "next";
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
  const title = "清醒夢 Lucid Dream｜艾歐澤亞深夜沙龍";
  const description = "為旅人留燈的清醒夢境。認識店員、查看活動、菜單與今夜店舖動態。";
  return {
    title,
    description,
    icons:{ icon:"/favicon.ico", shortcut:"/favicon.ico" },
    openGraph:{ title, description, type:"website" },
    twitter:{ card:"summary", title, description },
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
