"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Unlock, Plus, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";
import { fmtDateTime } from "@/lib/period";
import { useToast } from "./toast";

interface U { id: string; email: string; name: string; isSystemAdmin: boolean; isActive: boolean; lastLoginAt: string | null; memberships: { role: string; company: { name: string; taxCode: string } }[] }
const ROLE: Record<string, string> = { COMPANY_ADMIN: "QT công ty", EDITOR: "Editor", VIEWER: "Viewer" };

export function UsersAdmin({ users, meId }: { users: U[]; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [busy, setBusy] = useState(false);
  const fail = (e: unknown) => e instanceof ApiError && toast({ tone: "error", title: e.info.message, hint: e.info.hint });

  async function patch(u: U, body: Record<string, unknown>, ok: string) {
    try { await api(`/api/users/${u.id}`, { method: "PATCH", json: body }); toast({ tone: "success", title: ok }); router.refresh(); } catch (e) { fail(e); }
  }
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setBusy(true); setErr(null);
    try {
      await api("/api/users", { method: "POST", json: { email: fd.get("email"), name: fd.get("name"), password: fd.get("password"), isSystemAdmin: fd.get("isSystemAdmin") === "on" } });
      toast({ tone: "success", title: "Đã tạo tài khoản." });
      form.reset();
      router.refresh();
    } catch (e) { setErr(e instanceof ApiError ? e.info : { message: "Lỗi" }); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="overflow-hidden xl:col-span-2">
        <table className="table-base" data-testid="users-table">
          <thead><tr><th>Người dùng</th><th>Công ty & vai trò</th><th>Đăng nhập gần nhất</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><p className="font-medium">{u.name} {u.isSystemAdmin && <Badge tone="violet"><ShieldCheck className="h-3 w-3" /> QT hệ thống</Badge>}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                <td className="text-xs">{u.memberships.length === 0 ? <span className="text-muted-foreground">—</span> : u.memberships.map((m, i) => <p key={i}>{m.company.taxCode} · {ROLE[m.role]}</p>)}</td>
                <td className="text-xs">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Chưa đăng nhập"}</td>
                <td>{u.isActive ? <Badge tone="green">Hoạt động</Badge> : <Badge tone="red">Đã khóa</Badge>}</td>
                <td>
                  {u.id !== meId && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { const p = prompt(`Mật khẩu mới cho ${u.email} (≥ 8 ký tự, có chữ và số):`); if (p) patch(u, { password: p }, "Đã đặt lại mật khẩu."); }}><KeyRound /> Đặt lại MK</Button>
                      <Button size="sm" variant="ghost" className={u.isActive ? "text-red-600" : "text-emerald-600"} onClick={() => patch(u, { isActive: !u.isActive }, u.isActive ? "Đã khóa tài khoản." : "Đã mở khóa.")}>{u.isActive ? <Lock /> : <Unlock />} {u.isActive ? "Khóa" : "Mở khóa"}</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardHeader><CardTitle>Tạo tài khoản</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-3">
            {err && <Alert title={err.message} hint={err.hint} />}
            <Field label="Email"><Input name="email" type="email" required /></Field>
            <Field label="Họ tên"><Input name="name" required /></Field>
            <Field label="Mật khẩu ban đầu" hint="Tối thiểu 8 ký tự, có chữ và số."><Input name="password" required minLength={8} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isSystemAdmin" /> Quản trị hệ thống (toàn quyền mọi công ty)</label>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />} Tạo tài khoản</Button>
            <p className="text-xs text-muted-foreground">Để gán tài khoản vào công ty: vào Công ty → Thành viên → “Tài khoản có sẵn”.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
