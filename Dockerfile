# FDI Invoice & Tax Automation Pro – image production
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000
COPY --from=build /app ./
# Chạy bằng root để ghi được vào ổ đĩa gắn ngoài (Render disk mount tại /app/storage-data)
RUN mkdir -p /app/storage-data
EXPOSE 3000
# Tự chạy migration (không xóa dữ liệu) + seed admin (chỉ khi DB chưa có người dùng) rồi khởi động
CMD ["sh", "scripts/start.sh"]
