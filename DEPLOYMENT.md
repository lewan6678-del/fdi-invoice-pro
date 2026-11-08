# Hướng dẫn triển khai cloud

Ứng dụng đóng gói sẵn bằng `Dockerfile`; khi khởi động, container tự chạy migration (không xóa dữ liệu) và tạo tài khoản admin nếu DB còn trống.

## Phương án khuyến nghị: Render Blueprint (ít thao tác nhất)

File `render.yaml` đã có sẵn. Render tự tạo: PostgreSQL, web service (Docker), ổ đĩa riêng tư 5GB cho XML/PDF, chứng chỉ HTTPS.

1. Đưa mã nguồn lên GitHub (một repository riêng tư).
2. Trên render.com: **New → Blueprint →** chọn repository → nhập `SEED_ADMIN_PASSWORD` → **Apply**.

Sau ~5–10 phút có địa chỉ dạng `https://fdi-invoice-pro.onrender.com`. Mỗi lần đẩy code mới lên GitHub, Render tự triển khai lại.

## Phương án khác

| Nền tảng | Ghi chú |
|---|---|
| Railway / Fly.io | Dùng `Dockerfile`; thêm PostgreSQL; gắn volume tại `/app/storage-data` hoặc dùng S3 |
| Máy chủ riêng / VPS | `docker compose up -d` (file `docker-compose.yml`: db + app + worker) |
| Vercel | Không khuyến nghị cho bản hiện tại: cần `STORAGE_DRIVER=s3` (Vercel không có ổ đĩa bền) và worker riêng cho xử lý nền |

## Lưu trữ file S3 / Cloudflare R2 (tùy chọn)

```
STORAGE_DRIVER=s3
S3_BUCKET=fdi-invoices          # bucket PRIVATE
S3_REGION=auto
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

File được ghi với điều kiện `If-None-Match: *` → không thể ghi đè (bất biến).

## Xử lý nền khi chạy nhiều máy chủ

Đặt `JOB_MODE=worker` cho web và chạy thêm một tiến trình `npm run worker`. Nhiều worker chạy song song an toàn.

## Sao lưu

- Database: bật backup tự động của nhà cung cấp PostgreSQL (Render có sẵn ở gói trả phí).
- File XML/PDF: sao lưu ổ đĩa hoặc bật versioning trên bucket S3/R2.
