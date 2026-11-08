"use client";
import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";

export function PasswordForm() {
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setErr(null); setOk(false);
    if (fd.get("next") !== fd.get("confirm")) return setErr({ message: "Mật khẩu nhập lại không khớp.", hint: "Gõ lại mật khẩu mới ở cả hai ô." });
    setBusy(true);
    try {
      await api("/api/account/password", { method: "POST", json: { current: fd.get("current"), next: fd.get("next") } });
      setOk(true);
      form.reset();
    } catch (e) { setErr(e instanceof ApiError ? e.info : { message: "Lỗi" }); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="max-w-md space-y-3">
      {err && <Alert title={err.message} hint={err.hint} />}
      {ok && <Alert tone="success" title="Đã đổi mật khẩu thành công." />}
      <Field label="Mật khẩu hiện tại"><Input name="current" type="password" required /></Field>
      <Field label="Mật khẩu mới" hint="Tối thiểu 8 ký tự, có chữ và số."><Input name="next" type="password" required minLength={8} /></Field>
      <Field label="Nhập lại mật khẩu mới"><Input name="confirm" type="password" required /></Field>
      <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Đổi mật khẩu</Button>
    </form>
  );
}
