# Trạng thái dự án – FDI Invoice & Tax Automation Pro

Cập nhật: 08/11/2026 · Phiên bản 0.2.0

## Phase 01 – Nền tảng ✅ Hoàn thành

| Hạng mục | Trạng thái | Kiểm thử |
|---|---|---|
| Trang đăng nhập, phiên lưu DB, đăng xuất, hết hạn phiên | ✅ | integration + E2E |
| Quản lý tài khoản (tạo, khóa, đặt lại MK, tự đổi MK) | ✅ | integration |
| Quản lý nhiều công ty: thêm / sửa / ngừng hoạt động / kích hoạt | ✅ | integration + E2E |
| MST (kiểm tra định dạng, chống trùng), tên, địa chỉ, năm tài chính | ✅ | integration |
| Phân quyền System Admin / Company Admin / Editor / Viewer | ✅ | integration + E2E |
| Dashboard kết nối dữ liệu thật | ✅ | E2E |
| Database migrations (Prisma) | ✅ | chạy mỗi lần test |
| API lưu trữ | ✅ | |
| Kiểm thử tenant isolation | ✅ | integration + E2E |
| Audit log (thao tác thay đổi dữ liệu) | ✅ | |

## Phase 02 – Hóa đơn điện tử ✅ Hoàn thành

| Hạng mục | Trạng thái |
|---|---|
| Upload nhiều XML/PDF/ZIP, kéo thả, thanh tiến trình | ✅ |
| Tự nhận diện XML hóa đơn (theo nội dung, không chỉ đuôi file) | ✅ |
| Xử lý namespace, hồ sơ bọc ngoài (TDiep) | ✅ |
| Người bán/mua, ký hiệu, số, ngày lập, MST, mã CQT | ✅ |
| Dòng hàng: ĐVT, số lượng, đơn giá, chiết khấu, thành tiền, thuế suất | ✅ |
| Nhiều mức thuế GTGT (10/8/5/0%, KCT, KKKNT, KHAC) | ✅ |
| Hóa đơn thay thế/điều chỉnh + liên kết hóa đơn gốc | ✅ |
| XML gốc bất biến (write-once + SHA-256) | ✅ |
| Lưu PDF, tự ghép theo tên, đính kèm thủ công | ✅ |
| Xem hóa đơn (modal: chung / hàng hóa / thuế / XML-PDF) | ✅ |
| Chống trùng (không ghi đè) | ✅ |
| Báo cáo lỗi import từng file + hướng khắc phục | ✅ |
| ZIP nhiều file xử lý độc lập | ✅ |
| Lịch sử import theo công ty | ✅ |
| Tìm kiếm theo tháng / quý / năm | ✅ |
| Tiền/thuế kiểu NUMERIC + Decimal | ✅ |
| Xuất Excel (danh sách + chi tiết hàng hóa) | ✅ |
| Xử lý nền (hàng đợi DB, worker riêng tùy chọn) | ✅ |

## Module mở rộng – kiến trúc đã chuẩn bị, chưa triển khai

Hiển thị “Đang phát triển” trên giao diện, **không có nút giả**.

| Module | Trạng thái | Nền tảng sẵn có |
|---|---|---|
| Quan hệ HĐ điều chỉnh/thay thế | ✅ **Đã hoạt động** (trang riêng + modal) | — |
| Cảnh báo rủi ro | 🚧 Đang phát triển | Dữ liệu HĐ, hàng đợi nền |
| Phân loại hiệu lực | 🟡 Một phần: trạng thái Hiệu lực/Bị thay thế/Bị điều chỉnh tự động; chưa có quy tắc khấu trừ | `invoices.status` |
| Tờ khai thuế GTGT 01/GTGT | 🚧 | `invoice_tax_summaries` |
| Phụ lục giảm thuế | 🚧 | `invoice_lines.tax_rate` |
| Bảng kê mua vào/bán ra (mẫu chuẩn) | 🟡 Đã có xuất Excel danh sách; chưa có mẫu bảng kê chuẩn | ExcelJS |
| MISA Offline | 🚧 | |
| Đối chiếu ERP | 🚧 | |
| Quản trị FDI (hợp nhất, song ngữ) | 🚧 | `exchange_rate`, `investor_country` |
| Audit log | ✅ **Đã hoạt động** | |
| AI Accounting Assistant | 🚧 Cần khóa API mô hình AI | RBAC theo company_id |

## Hạn chế đã biết

- Chưa xác minh chữ ký số (DSCKS) trong XML.
- Chưa có “quên mật khẩu” qua email (admin đặt lại mật khẩu).
- PDF chỉ lưu và hiển thị, không đọc nội dung PDF (dữ liệu lấy từ XML).
- Chưa có xác thực 2 lớp.
- Image Docker chưa được build thử trong phiên này (Docker Hub giới hạn lượt tải – lỗi 429); build ứng dụng và toàn bộ test đã chạy thành công.
