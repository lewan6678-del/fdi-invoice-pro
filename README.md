# FDI Invoice & Tax Automation Pro

Hệ thống quản lý **hóa đơn điện tử, kế toán thuế** cho nhiều doanh nghiệp FDI trên một nền tảng web.
Giao diện tiếng Việt, dữ liệu cô lập theo từng công ty (MST), lưu trữ trên PostgreSQL.

## Chức năng đã hoạt động (Phase 01 + Phase 02)

| Nhóm | Chức năng |
|---|---|
| Đăng nhập | Đăng nhập email/mật khẩu (bcrypt), phiên lưu trong DB (cookie httpOnly), tự hết hạn sau 12 giờ, khóa tài khoản |
| Phân quyền | Quản trị hệ thống · Quản trị công ty · Kế toán (Editor) · Chỉ xem (Viewer) |
| Công ty | Thêm / sửa / ngừng hoạt động / kích hoạt lại; MST, tên, tên tiếng Anh, địa chỉ, năm tài chính, tháng bắt đầu năm tài chính, quốc gia nhà đầu tư |
| Người dùng | Tạo tài khoản, gán vào công ty, đổi vai trò, xóa khỏi công ty, khóa/mở khóa, đặt lại mật khẩu, tự đổi mật khẩu |
| Tổng quan | Số hóa đơn mua vào/bán ra, giá trị, thuế đầu ra − đầu vào, biểu đồ 12 tháng, tổng hợp theo thuế suất, lượt nhập gần đây – **dữ liệu thật từ DB** |
| Nhập hóa đơn | Kéo thả nhiều file XML/PDF/ZIP, thanh tiến trình tải lên + xử lý, xử lý nền, báo cáo từng file (thành công / trùng / lỗi + hướng khắc phục), lịch sử nhập theo công ty |
| Đọc XML | Chuẩn TT78/NĐ123, xử lý namespace, hồ sơ bọc ngoài, người bán/mua, ký hiệu mẫu số, ký hiệu, số, ngày lập, MST, mã CQT, từng dòng hàng (ĐVT, số lượng, đơn giá, chiết khấu, thành tiền, thuế suất), nhiều mức thuế GTGT, hóa đơn thay thế/điều chỉnh |
| Lưu trữ | XML gốc lưu **bất biến** (ghi một lần, kèm SHA-256), PDF tự ghép theo tên file hoặc đính kèm thủ công, lưu trữ riêng tư (ổ đĩa máy chủ hoặc S3/R2) – chỉ tải được qua API có kiểm tra quyền |
| Chống trùng | Theo (công ty, MST người bán, mẫu số, ký hiệu, số HĐ) – nhập lại không ghi đè dữ liệu cũ |
| Tra cứu | Lọc theo tháng / quý / năm, mua vào / bán ra, tính chất, tìm theo số HĐ, MST, tên |
| Chi tiết | Modal với các tab: Thông tin chung · Hàng hóa · Thuế · XML/PDF |
| Excel | Xuất danh sách hóa đơn + chi tiết hàng hóa (chỉ dữ liệu công ty đang chọn) |
| Quan hệ HĐ | Tự liên kết hóa đơn thay thế/điều chỉnh với hóa đơn gốc (cả khi nhập gốc sau), đánh dấu “Bị thay thế / Bị điều chỉnh” |
| Nhật ký | Audit log mọi thao tác thay đổi dữ liệu |
| Giao diện | Sidebar nghiệp vụ, chọn công ty & kỳ kế toán trên header, chế độ tối, thông báo lỗi có hướng khắc phục |

Các module chưa có backend hiển thị nhãn **“Đang phát triển”** và không có nút thao tác giả. Xem `PROJECT_STATUS.md`.

## Tài khoản dùng thử

Sau khi khởi tạo, hệ thống có sẵn **Quản trị hệ thống**:

- Email: `admin@fdi.local` – Mật khẩu: giá trị `SEED_ADMIN_PASSWORD` (mặc định `Admin@12345`, **hãy đổi ngay** tại “Tài khoản của tôi”).

Nếu bật dữ liệu demo (`SEED_DEMO=true`), có thêm 2 công ty mẫu (MST `0109990001`, `0109990002`), mỗi công ty 3 tài khoản, mật khẩu `Demo@12345`:

| Vai trò | Email |
|---|---|
| Quản trị công ty | `qtcty.0109990001@demo.local` |
| Kế toán (Editor) | `ketoan.0109990001@demo.local` |
| Chỉ xem (Viewer) | `xem.0109990001@demo.local` |

(Thay `0109990001` bằng `0109990002` cho công ty Beta.)

**Quy trình tạo tài khoản mới** (không cần lập trình): đăng nhập admin → *Công ty* → *Thêm công ty* → bấm *Thành viên* → *Tạo tài khoản mới* (email, họ tên, mật khẩu, vai trò).

## Công nghệ

Next.js 15 (App Router) + TypeScript · Tailwind CSS + thành phần kiểu shadcn/ui (Radix) + Lucide Icons · PostgreSQL 16 + Prisma ORM (migrations) · fast-xml-parser · JSZip · ExcelJS · decimal.js (tiền/thuế dùng `NUMERIC(20,4)`, không dùng số thực) · Vitest + Playwright.

## Kiến trúc chính

```
src/
  app/(app)/…          Trang giao diện (server components) – dashboard, invoices, imports, companies, users, audit…
  app/api/…            API REST (route handlers), bọc bởi src/server/http.ts (xác thực, chống CSRF, lỗi tiếng Việt)
  server/auth/         Phiên đăng nhập, mật khẩu, RBAC (requireCompanyRole = điểm chặn tenant isolation)
  server/parser/       Bộ đọc XML hóa đơn TT78
  server/services/     Nghiệp vụ: companies, users, imports (hàng đợi nền), invoices, export, dashboard
  server/jobs/         Bộ chạy hàng đợi (inline trong web hoặc worker riêng: npm run worker)
  server/storage.ts    Lưu trữ riêng tư write-once (local / S3)
prisma/                schema.prisma, migrations, seed.ts
tests/                 unit, integration (PostgreSQL thật), e2e (trình duyệt thật), fixtures XML tổng hợp
```

**Cô lập dữ liệu:** mọi bảng nghiệp vụ có `company_id`; mọi truy vấn đi qua service kiểm tra quyền `requireCompanyRole` và lọc theo `company_id`. Người không thuộc công ty nhận lỗi 404 (không lộ dữ liệu tồn tại).

**Xử lý nền:** upload chỉ lưu file gốc + tạo `import_jobs`; xử lý từng file (`import_items`) chạy nền, có khóa `FOR UPDATE SKIP LOCKED`, tự khôi phục job bị gián đoạn sau 5 phút.

## Chạy kiểm thử

```bash
npm test            # unit + integration (DB tên chứa "test")
npm run test:e2e    # build trước: npm run build
```

## Triển khai cloud

Xem `DEPLOYMENT.md`. Biến môi trường: `.env.example`.
