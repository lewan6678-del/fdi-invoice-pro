"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Building2, CalendarRange, LogOut, Moon, Sun, UserCircle2, KeyRound } from "lucide-react";
import { Select } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "./toast";
import { parsePeriod } from "@/lib/period";

interface Props {
  user: { name: string; email: string; isSystemAdmin: boolean };
  companies: { id: string; name: string; taxCode: string; isActive: boolean }[];
  companyId: string | null;
  period: string;
}

export function Header({ user, companies, companyId, period }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  const p = parsePeriod(period)!;
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => thisYear + 1 - i);

  async function save(body: { companyId?: string; period?: string }) {
    try {
      await api("/api/workspace", { method: "POST", json: body });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError) toast({ tone: "error", title: e.info.message, hint: e.info.hint });
    }
  }
  function setPeriod(type: string, year: number, value: number) {
    const s = type === "month" ? `${year}-${String(value).padStart(2, "0")}` : type === "quarter" ? `${year}-Q${value}` : String(year);
    save({ period: s });
  }
  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
    setDark(next);
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/90 px-6 backdrop-blur xl:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Select aria-label="Chọn công ty" data-testid="company-select" className="w-[320px] max-w-[40vw]" value={companyId ?? ""} onChange={(e) => save({ companyId: e.target.value })} disabled={companies.length === 0}>
          {companies.length === 0 && <option value="">Chưa được gán công ty nào</option>}
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.taxCode} – {c.name}{c.isActive ? "" : " (Ngừng hoạt động)"}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <CalendarRange className="h-4 w-4 text-muted-foreground" />
        <Select aria-label="Loại kỳ" className="w-[92px]" value={p.type} onChange={(e) => setPeriod(e.target.value, p.year, e.target.value === "quarter" ? 1 : 1)}>
          <option value="month">Tháng</option>
          <option value="quarter">Quý</option>
          <option value="year">Năm</option>
        </Select>
        {p.type === "month" && (
          <Select aria-label="Tháng" className="w-[78px]" value={p.value} onChange={(e) => setPeriod("month", p.year, Number(e.target.value))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{String(i + 1).padStart(2, "0")}</option>)}
          </Select>
        )}
        {p.type === "quarter" && (
          <Select aria-label="Quý" className="w-[70px]" value={p.value} onChange={(e) => setPeriod("quarter", p.year, Number(e.target.value))}>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </Select>
        )}
        <Select aria-label="Năm" className="w-[86px]" value={p.year} onChange={(e) => setPeriod(p.type, Number(e.target.value), p.type === "year" ? Number(e.target.value) : p.value)}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={toggleTheme} className="rounded-md p-2 text-muted-foreground hover:bg-accent" aria-label="Chuyển giao diện sáng/tối" title="Giao diện sáng/tối">
          {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <DM.Root>
          <DM.Trigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent" data-testid="user-menu">
            <UserCircle2 className="h-6 w-6 text-muted-foreground" />
            <div className="hidden text-left leading-tight lg:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.isSystemAdmin ? "Quản trị hệ thống" : user.email}</p>
            </div>
          </DM.Trigger>
          <DM.Portal>
            <DM.Content align="end" sideOffset={6} className="z-50 min-w-[200px] rounded-md border bg-card p-1 text-sm shadow-lg">
              <DM.Item onSelect={() => router.push("/account")} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 outline-none hover:bg-accent"><KeyRound className="h-4 w-4" /> Đổi mật khẩu</DM.Item>
              <DM.Separator className="my-1 h-px bg-border" />
              <DM.Item onSelect={logout} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-red-600 outline-none hover:bg-accent"><LogOut className="h-4 w-4" /> Đăng xuất</DM.Item>
            </DM.Content>
          </DM.Portal>
        </DM.Root>
      </div>
    </header>
  );
}
