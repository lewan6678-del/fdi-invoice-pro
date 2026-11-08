"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, UploadCloud, GitCompareArrows, Building2, Users, ScrollText, UserCog, FileCheck2,
  ShieldAlert, BadgeCheck, Landmark, Percent, Sheet, Database, Network, Globe2, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULES } from "@/lib/modules";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "risk-alerts": ShieldAlert, validity: BadgeCheck, "vat-return": Landmark, "tax-reduction": Percent, "purchase-sale-ledger": Sheet,
  misa: Database, "erp-reconcile": Network, "fdi-admin": Globe2, "ai-assistant": Bot,
};

export function Sidebar({ isSystemAdmin, role }: { isSystemAdmin: boolean; role: string | null }) {
  const path = usePathname();
  const isAdmin = isSystemAdmin || role === "COMPANY_ADMIN";
  const Item = ({ href, icon: Icon, label, badge }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; badge?: string }) => {
    const active = path === href || path.startsWith(href + "/");
    return (
      <Link href={href} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors", active ? "bg-white/10 font-medium text-white" : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white")}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{label}</span>
        {badge && <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">{badge}</span>}
      </Link>
    );
  };
  const Group = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="space-y-0.5">
      <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{title}</p>
      {children}
    </div>
  );
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-sidebar px-3 pb-6 text-sidebar-foreground md:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-5">
        <div className="rounded-lg bg-blue-600 p-1.5 text-white"><FileCheck2 className="h-5 w-5" /></div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">FDI Invoice & Tax</p>
          <p className="text-[11px] text-sidebar-foreground/60">Automation Pro</p>
        </div>
      </Link>
      <Group title="Nghiệp vụ">
        <Item href="/dashboard" icon={LayoutDashboard} label="Tổng quan" />
        <Item href="/invoices" icon={FileText} label="Hóa đơn" />
        <Item href="/imports" icon={UploadCloud} label="Nhập hóa đơn" />
        <Item href="/relations" icon={GitCompareArrows} label="HĐ điều chỉnh / thay thế" />
      </Group>
      <Group title="Thuế & tích hợp">
        {MODULES.map((m) => (
          <Item key={m.slug} href={`/modules/${m.slug}`} icon={ICONS[m.slug] ?? FileText} label={m.title} badge={m.status === "dev" ? "Đang PT" : undefined} />
        ))}
      </Group>
      <Group title="Quản trị">
        <Item href="/companies" icon={Building2} label="Công ty" />
        {isSystemAdmin && <Item href="/users" icon={Users} label="Người dùng" />}
        {isAdmin && <Item href="/audit" icon={ScrollText} label="Nhật ký hệ thống" />}
        <Item href="/account" icon={UserCog} label="Tài khoản của tôi" />
      </Group>
    </aside>
  );
}
