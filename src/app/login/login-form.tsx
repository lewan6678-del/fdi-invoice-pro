"use client";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { api, ApiError } from "@/lib/api-client";

export function LoginForm() {
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setErr(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { email: fd.get("email"), password: fd.get("password") } });
      window.location.href = "/dashboard";
    } catch (e) {
      setErr(e instanceof ApiError ? e.info : { message: "Lỗi không xác định" });
      setBusy(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {err && <Alert title={err.message} hint={err.hint} />}
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required placeholder="ketoan@congty.vn" />
      </div>
      <div>
        <Label htmlFor="password">Mật khẩu</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Đăng nhập
      </Button>
    </form>
  );
}
