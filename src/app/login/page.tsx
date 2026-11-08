import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/current";
import { LoginForm } from "./login-form";
import { FileCheck2, ShieldCheck, Building2 } from "lucide-react";

export default async function LoginPage() {
  if (await getActor()) redirect("/dashboard");
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/10 p-2"><FileCheck2 className="h-6 w-6" /></div>
          <span className="text-lg font-semibold">FDI Invoice & Tax Pro</span>
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">Tự động hóa hóa đơn điện tử & thuế cho doanh nghiệp FDI</h2>
          <ul className="space-y-3 text-blue-100">
            <li className="flex gap-3"><FileCheck2 className="h-5 w-5 shrink-0" /> Đọc XML hóa đơn chuẩn TT78, nhập hàng loạt XML/PDF/ZIP</li>
            <li className="flex gap-3"><Building2 className="h-5 w-5 shrink-0" /> Quản lý nhiều công ty, nhiều MST trên một hệ thống</li>
            <li className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0" /> Phân quyền chặt chẽ, dữ liệu cô lập theo từng công ty</li>
          </ul>
        </div>
        <p className="text-sm text-blue-200">© {new Date().getFullYear()} FDI Invoice & Tax Automation Pro</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">Đăng nhập</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Sử dụng tài khoản do quản trị viên cấp.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
