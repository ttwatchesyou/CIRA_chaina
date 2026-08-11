"use client";

import {
  Boxes,
  ChevronLeft,
  Database,
  FolderKanban,
  ImageUp,
  Layers3,
  Settings,
  Sparkles,
  Tags,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AccountMenu } from "@/components/auth/account-menu";
import type { AuthUser } from "@/types/auth";

type ProjectSidebarProps = {
  projectId: string;
  projectName: string;
  user: AuthUser;
};

const navigation = [
  { label: "ภาพรวม", suffix: "", icon: FolderKanban },
  { label: "อัปโหลด", suffix: "/upload", icon: ImageUp },
  { label: "ทำ Annotation", suffix: "/annotate", icon: Tags },
  { label: "Dataset", suffix: "/dataset", icon: Database },
  { label: "Train โมเดล", suffix: "/training", icon: Sparkles },
  { label: "โมเดล", suffix: "/models", icon: Layers3 },
  { label: "ตั้งค่า", suffix: "/settings", icon: Settings },
];

export function ProjectSidebar({ projectId, projectName, user }: ProjectSidebarProps) {
  const pathname = usePathname();
  const projectRoot = `/projects/${projectId}`;

  return (
    <aside className="flex w-full shrink-0 flex-col border-b bg-[linear-gradient(165deg,#243c5c_0%,#33264e_52%,#493467_100%)] text-slate-200 md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-b-0 md:border-r md:border-[#594477]/70">
      <div className="border-b border-white/10 px-4 py-4">
        <Link href="/" className="guide-action inline-flex items-center gap-1.5 text-xs font-medium text-[#bdd8f2] hover:text-white"><ChevronLeft className="size-3.5" />โปรเจกต์ทั้งหมด</Link>
        <div className="mt-4 flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#dcecff]/15 text-[#a9d2f5]"><Boxes className="size-4 fill-[#a9d2f5]/10" /></span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{projectName}</p>
            <p className="mt-0.5 text-xs text-[#b9b0ca]">ตรวจจับวัตถุ</p>
          </div>
        </div>
      </div>
      <nav aria-label="เมนูโปรเจกต์" className="flex gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
        {navigation.map((item) => {
          const href = `${projectRoot}${item.suffix}`;
          const active = item.suffix === "" ? pathname === href : pathname.startsWith(href);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={href}
              className={`guide-action inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-white/14 font-semibold text-white shadow-sm ring-1 ring-white/10" : "text-slate-200 hover:bg-white/8 hover:text-white"}`}
            >
              <Icon className="size-4" aria-hidden />{item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-white/10 px-4 py-4 md:block"><AccountMenu user={user} dark /></div>
    </aside>
  );
}
