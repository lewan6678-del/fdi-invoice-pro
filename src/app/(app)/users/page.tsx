import { getWorkspace } from "@/server/auth/current";
import { listUsers } from "@/server/services/users";
import { PageHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { UsersAdmin } from "@/components/app/users-admin";

export default async function UsersPage() {
  const ws = await getWorkspace();
  if (!ws.actor.isSystemAdmin) return <Alert title="Chỉ Quản trị hệ thống được truy cập trang này." hint="Quản trị công ty quản lý thành viên tại mục Công ty → Thành viên." />;
  const users = await listUsers(ws.actor);
  return (
    <div>
      <PageHeader title="Quản lý người dùng" description="Tạo, khóa, đặt lại mật khẩu tài khoản toàn hệ thống." />
      <UsersAdmin users={JSON.parse(JSON.stringify(users))} meId={ws.actor.id} />
    </div>
  );
}
