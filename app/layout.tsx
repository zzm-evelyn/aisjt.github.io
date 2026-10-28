import type { Metadata } from "next";
import "./globals.css";
import "./assessment.css";
import "./participant.css";

export const metadata: Metadata = {
  title: "情景判断测验生成平台",
  description:
    "基于人格构念的情景判断测验生成、质量审查、AI 评分与题目管理平台。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        {children}
      </body>
    </html>
  );
}
