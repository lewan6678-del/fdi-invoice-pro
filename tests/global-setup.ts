import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

/** Chuẩn bị DB kiểm thử. CHỈ chạy trên database có tên chứa "test" để không bao giờ chạm dữ liệu thật. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/fdi_test";
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error(`Từ chối chạy test trên database "${dbName}" (tên phải chứa "test").`);
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
  execSync(`npx prisma db execute --url "${url}" --stdin`, { input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;", env, stdio: ["pipe", "inherit", "inherit"] });
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" });
  rmSync(".test-storage", { recursive: true, force: true });
}
