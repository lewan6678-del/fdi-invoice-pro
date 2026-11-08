"use client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <Alert title="Không thể hiển thị trang này: dữ liệu không tồn tại hoặc bạn không có quyền truy cập." hint="Kiểm tra công ty đang chọn ở thanh trên cùng (dữ liệu được tách riêng theo từng công ty), sau đó thử lại." />
      <div className="flex gap-2">
        <Button onClick={reset}>Thử lại</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>Về trang Tổng quan</Button>
      </div>
    </div>
  );
}
