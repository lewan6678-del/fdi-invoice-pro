import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function NoCompany({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  return (
    <Card>
      <EmptyState
        icon={<Building2 className="h-6 w-6" />}
        title="Chưa có công ty nào để làm việc"
        description={isSystemAdmin ? "Tạo công ty đầu tiên (MST, tên, địa chỉ, năm tài chính) để bắt đầu nhập hóa đơn." : "Tài khoản của bạn chưa được gán vào công ty nào. Liên hệ Quản trị công ty để được cấp quyền."}
        action={isSystemAdmin ? <Button asChild><Link href="/companies">Tạo công ty</Link></Button> : undefined}
      />
    </Card>
  );
}
