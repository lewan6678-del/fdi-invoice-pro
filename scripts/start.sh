#!/bin/sh
# Khởi động production: chuẩn hóa chuỗi kết nối, migrate (không xóa dữ liệu), seed admin (chỉ khi DB trống), chạy web.
set -e
# Neon: dùng kết nối trực tiếp (bỏ "-pooler") để Prisma migrate hoạt động; bỏ tham số channel_binding.
DATABASE_URL=$(printf '%s' "$DATABASE_URL" | sed -e 's/-pooler\././' -e 's/[&?]channel_binding=[a-z]*//')
case "$DATABASE_URL" in
  *connection_limit=*) ;;
  *\?*) DATABASE_URL="$DATABASE_URL&connection_limit=5" ;;
  *) DATABASE_URL="$DATABASE_URL?connection_limit=5" ;;
esac
export DATABASE_URL
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"
npx prisma migrate deploy
npx tsx prisma/seed.ts
exec npx next start -p "${PORT:-3000}"
