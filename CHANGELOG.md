# Nhật ký thay đổi

## [0.2.1] – 08/11/2026
- Triển khai **miễn phí**: Neon (database + file) + Render Free.
- Thêm driver lưu trữ `db` (bảng `file_blobs`, ghi một lần).
- Thêm `scripts/start.sh` (tự chuẩn hóa chuỗi kết nối Neon, migrate, seed).
- Driver S3 kiểm tra tồn tại trước khi ghi (tương thích R2/Supabase).

## [0.2.0] – 08/11/2026

### Thêm mới
- **Phase 01:** đăng nhập/phiên DB, RBAC 4 vai trò, quản lý nhiều công ty, quản lý người dùng & thành viên, dashboard dữ liệu thật, audit log, migrations.
- **Phase 02:** upload XML/PDF/ZIP kéo thả, xử lý nền, bộ đọc XML TT78 (namespace, nhiều dòng hàng, nhiều thuế suất, thay thế/điều chỉnh), lưu XML gốc bất biến, ghép PDF, chống trùng, báo cáo lỗi từng file, lịch sử nhập, tra cứu theo tháng/quý/năm, modal chi tiết 4 tab, xuất Excel.
- Trang “HĐ điều chỉnh / thay thế”.
- Trang trạng thái cho module đang phát triển.
- Dark mode, giao diện tiếng Việt.
- Dockerfile, docker-compose, Render Blueprint.
- 35 test unit/integration + 14 kịch bản E2E trình duyệt.
