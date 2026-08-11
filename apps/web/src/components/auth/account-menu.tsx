import { HardDrive, UserRound } from "lucide-react";

import type { AuthUser } from "@/types/auth";

export function AccountMenu({ user, dark = false }: { user: AuthUser; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${dark ? "text-slate-200" : "text-ink"}`}>
      <span className={`grid size-8 place-items-center rounded-full ${dark ? "bg-[#29435a] text-[#bcd4e5]" : "bg-[#eaf0f4] text-primary"}`}><UserRound className="size-4" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">พื้นที่ทำงานส่วนกลาง</p><p className={`truncate text-xs ${dark ? "text-slate-400" : "text-muted"}`}>ที่เก็บข้อมูลในเครื่อง · {user.name}</p></div>
      <HardDrive className={`size-4 shrink-0 ${dark ? "text-slate-500" : "text-slate-400"}`} aria-hidden />
    </div>
  );
}
