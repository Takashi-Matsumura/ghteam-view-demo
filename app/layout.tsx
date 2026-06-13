import type { Metadata } from "next";
import Link from "next/link";
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

export const metadata: Metadata = {
  title: "GHTeam View",
  description: "GitHub のリポジトリ・チーム活動を可視化するダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 font-sans dark:bg-black">
        <header className="border-b border-black/[.08] bg-white dark:border-white/[.12] dark:bg-zinc-950">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-4">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              GHTeam View
            </Link>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">activity dashboard</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
