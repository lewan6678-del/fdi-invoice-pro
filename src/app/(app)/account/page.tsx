import { getWorkspace } from "@/server/auth/current";
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Badge } from "@/components/ui/card";
import { PasswordForm } from "@/components/app/password-form";

const ROLE: Record<string, string> = { SYSTEM_ADMIN: "Quản trị hệ thống", COMPANY_ADMIN: "Quản trị công ty", EDITOR: "Kế toán (Editor)", VIEWER: "Chỉ xem (Viewer)" };

export default async function AccountPage() {
  const ws = await getWorkspace();
  return (
    <div>
      <PageHeader title="Tài khoản của tôi" description={`${ws.actor.name} · ${ws.actor.email}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Đổi mật khẩu</CardTitle></CardHeader><CardContent><PasswordForm /></CardContent></Card>
        <Card>
          <CardHeader><CardTitle>Quyền truy cập</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {ws.actor.isSystemAdmin && <Badge tone="violet">Quản trị hệ thống – toàn quyền mọi công ty</Badge>}
            {ws.companies.map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b py-2 last:border-0">
                <span>{c.taxCode} – {c.name}</span>
                <Badge tone="blue">{ROLE[c.myRole ?? ""]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
