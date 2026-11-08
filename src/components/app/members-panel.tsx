"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";
import { useToast } from "./toast";

interface Member { id: string; role: string; user: { id: string; email: string; name: string; isActive: boolean; lastLoginAt: string | null } }
const ROLES = [
  { v: "COMPANY_ADMIN", l: "Quản trị công ty", d: "Toàn quyền công ty, quản lý thành viên" },
  { v: "EDITOR", l: "Kế toán (Editor)", d: "Nhập hóa đơn, xuất dữ liệu" },
  { v: "VIEWER", l: "Chỉ xem (Viewer)", d: "Xem và xuất dữ liệu" },
];

export function MembersPanel({ companyId, members, canAdmin, meId }: { companyId: string; members: Member[]; canAdmin: boolean; meId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => e instanceof ApiError && toast({ tone: "error", title: e.info.message, hint: e.info.hint });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/companies/${companyId}/members`, { method: "POST", json: { ...fd, mode } });
      toast({ tone: "success", title: mode === "new" ? `Đã tạo tài khoản ${fd.email}.` : `Đã thêm ${fd.email} vào công ty.` });
      form.reset();
      router.refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.info : { message: "Lỗi" });
    } finally {
      setBusy(false);
    }
  }
  async function changeRole(m: Member, role: string) {
    try { await api(`/api/companies/${companyId}/members/${m.id}`, { method: "PATCH", json: { role } }); toast({ tone: "success", title: "Đã cập nhật vai trò." }); router.refresh(); } catch (e) { fail(e); }
  }
  async function remove(m: Member) {
    if (!confirm(`Xóa ${m.user.email} khỏi công ty? Tài khoản vẫn tồn tại nhưng không còn truy cập dữ liệu công ty này.`)) return;
    try { await api(`/api/companies/${companyId}/members/${m.id}`, { method: "DELETE" }); toast({ tone: "success", title: "Đã xóa thành viên." }); router.refresh(); } catch (e) { fail(e); }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2 overflow-hidden">
        <CardHeader><CardTitle>Thành viên ({members.length})</CardTitle><CardDescription>Người dùng có quyền truy cập dữ liệu công ty này.</CardDescription></CardHeader>
        <table className="table-base" data-testid="members-table">
          <thead><tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-medium">{m.user.name}</td>
                <td>{m.user.email}</td>
                <td>
                  {canAdmin && m.user.id !== meId ? (
                    <Select className="w-48" value={m.role} onChange={(e) => changeRole(m, e.target.value)} aria-label="Vai trò">
                      {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
                    </Select>
                  ) : <Badge tone="blue">{ROLES.find((r) => r.v === m.role)?.l}</Badge>}
                </td>
                <td>{m.user.isActive ? <Badge tone="green">Hoạt động</Badge> : <Badge tone="red">Đã khóa</Badge>}</td>
                <td className="text-right">{canAdmin && m.user.id !== meId && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(m)}><Trash2 /> Xóa</Button>}</td>
              </tr>
            ))}
            {members.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Chưa có thành viên.</td></tr>}
          </tbody>
        </table>
      </Card>
      {canAdmin ? (
        <Card>
          <CardHeader><CardTitle>Thêm thành viên</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1 text-sm">
              <button type="button" className={`flex-1 rounded-md py-1.5 ${mode === "new" ? "bg-card shadow-sm" : ""}`} onClick={() => setMode("new")}>Tạo tài khoản mới</button>
              <button type="button" className={`flex-1 rounded-md py-1.5 ${mode === "existing" ? "bg-card shadow-sm" : ""}`} onClick={() => setMode("existing")}>Tài khoản có sẵn</button>
            </div>
            <form onSubmit={add} className="space-y-3" data-testid="member-form">
              {err && <Alert title={err.message} hint={err.hint} />}
              <Field label="Email"><Input name="email" type="email" required /></Field>
              {mode === "new" && (
                <>
                  <Field label="Họ tên"><Input name="name" required /></Field>
                  <Field label="Mật khẩu ban đầu" hint="Tối thiểu 8 ký tự, có chữ và số."><Input name="password" type="text" required minLength={8} /></Field>
                </>
              )}
              <Field label="Vai trò">
                <Select name="role" defaultValue="EDITOR">
                  {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l} – {r.d}</option>)}
                </Select>
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} {mode === "new" ? "Tạo & thêm vào công ty" : "Thêm vào công ty"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Alert tone="info" title="Chỉ Quản trị công ty mới được thêm/sửa thành viên." />
      )}
    </div>
  );
}
