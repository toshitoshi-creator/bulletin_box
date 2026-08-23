import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeInit } from "@/components/ThemeInit";
import { AppShell } from "@/components/layout/AppShell";
import { ToastProvider } from "@/components/ui/Toast";
import { AddSiteDialogProvider } from "@/components/site/AddSiteDialogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WEB SHELF",
  description: "登録したWebサイトのコンテンツを、読みやすく整理された自分だけのライブラリとして閲覧するアプリ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#16140f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <ThemeInit />
      </head>
      <body className="min-h-full antialiased">
        <ToastProvider>
          <AddSiteDialogProvider>
            <AppShell>{children}</AppShell>
          </AddSiteDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
