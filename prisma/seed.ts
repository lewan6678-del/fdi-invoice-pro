/**
 * Seed: chỉ tạo tài khoản Quản trị hệ thống nếu CHƯA có người dùng nào.
 * Không bao giờ ghi đè dữ liệu đã có.
 * Đặt SEED_DEMO=true để thêm 2 công ty mẫu + tài khoản demo (dữ liệu tổng hợp, không phải hóa đơn thật).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count === 0) {
    const email = (process.env.SEED_ADMIN_EMAIL || "admin@fdi.local").toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
    await prisma.user.create({ data: { email, name: "Quản trị hệ thống", passwordHash: await bcrypt.hash(password, 11), isSystemAdmin: true } });
    console.log(`✔ Đã tạo Quản trị hệ thống: ${email}`);
  } else {
    console.log("• Đã có người dùng – bỏ qua tạo admin (không ghi đè).");
  }
  if (process.env.SEED_DEMO === "true") {
    const demo = [
      { taxCode: "0109990001", name: "CÔNG TY TNHH DEMO FDI ALPHA (dữ liệu mẫu)", address: "KCN Mẫu, Bắc Ninh", investorCountry: "Nhật Bản" },
      { taxCode: "0109990002", name: "CÔNG TY TNHH DEMO FDI BETA (dữ liệu mẫu)", address: "KCN Mẫu, Bình Dương", investorCountry: "Hàn Quốc" },
    ];
    for (const d of demo) {
      const c = await prisma.company.upsert({ where: { taxCode: d.taxCode }, update: {}, create: { ...d, currentFiscalYear: new Date().getFullYear() } });
      const roles = [
        { email: `ketoan.${d.taxCode}@demo.local`, name: `Kế toán ${d.taxCode}`, role: "EDITOR" as const },
        { email: `xem.${d.taxCode}@demo.local`, name: `Chỉ xem ${d.taxCode}`, role: "VIEWER" as const },
        { email: `qtcty.${d.taxCode}@demo.local`, name: `QT công ty ${d.taxCode}`, role: "COMPANY_ADMIN" as const },
      ];
      for (const r of roles) {
        const u = await prisma.user.upsert({ where: { email: r.email }, update: {}, create: { email: r.email, name: r.name, passwordHash: await bcrypt.hash("Demo@12345", 11) } });
        await prisma.membership.upsert({ where: { userId_companyId: { userId: u.id, companyId: c.id } }, update: {}, create: { userId: u.id, companyId: c.id, role: r.role } });
      }
    }
    console.log("✔ Đã tạo dữ liệu demo (mật khẩu Demo@12345).");
  }
}
main().finally(() => prisma.$disconnect());
