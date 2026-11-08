import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-semibold">404</p>
      <p className="text-muted-foreground">Không tìm thấy trang.</p>
      <Link href="/dashboard" className="text-primary hover:underline">Về trang Tổng quan</Link>
    </div>
  );
}
