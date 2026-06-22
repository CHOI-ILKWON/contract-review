import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 계약서 검토 시스템",
  description: "3-Agent 완전 검토 · 누락 조항 자동 감지 · CEO 보고서 자동 생성",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
