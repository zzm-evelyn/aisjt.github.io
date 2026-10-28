"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Layers3, FolderKanban, Library, Settings2, BookOpenCheck } from "lucide-react";
const links = [
  { href: "/", label: "任务中心", icon: FolderKanban },
  { href: "/library", label: "题目库", icon: Library },
  { href: "/assessments", label: "测验管理", icon: BookOpenCheck },
  { href: "/settings", label: "项目设置", icon: Settings2 },
];
export function AppHeader({ children }: { children?: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <header className="v3-nav">
      <Link href="/" className="v3-brand">
        <Layers3 size={24} />
        <span>
          情景判断测验
          <br />
          生成平台
        </span>
      </Link>
      <label className="v3-project">
        当前项目
        <select aria-label="当前项目" defaultValue="local">
          <option value="local">人格测评研究</option>
        </select>
      </label>
      <nav aria-label="主导航">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={
              (
                l.href === "/"
                  ? path === "/" ||
                    path.startsWith("/workspace") ||
                    path.startsWith("/tasks")
                  : path.startsWith(l.href)
              )
                ? "page"
                : undefined
            }
          >
            <l.icon size={18} />
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="v3-nav-foot">独立条目集 · 版本追溯</div>
      <button className="v3-secondary" onClick={async () => {
        const response = await fetch("/api/auth/logout", { method: "POST" });
        if (response.ok) { router.push("/admin/login"); router.refresh(); }
      }}>退出登录</button>
      {children}
    </header>
  );
}
