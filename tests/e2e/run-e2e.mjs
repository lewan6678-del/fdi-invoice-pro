// Chạy E2E: tạo DB riêng (tên chứa "test"), migrate, seed demo, khởi động server production, chạy kịch bản trình duyệt.
import { execSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";

const DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/fdi_e2e_test";
const name = new URL(DB).pathname.slice(1);
if (!/test/i.test(name)) throw new Error("E2E chỉ chạy trên DB có tên chứa 'test'");
const PORT = process.env.E2E_PORT ?? "3100";
const env = { ...process.env, DATABASE_URL: DB, STORAGE_DRIVER: "local", STORAGE_LOCAL_DIR: "./.test-storage/e2e", SEED_DEMO: "true", JOB_MODE: "inline", PORT };

const admin = new URL(DB); admin.pathname = "/postgres";
try {
  execSync(`npx prisma db execute --url "${admin}" --stdin`, { input: `CREATE DATABASE ${name};`, env, stdio: ["pipe", "ignore", "ignore"] });
} catch { /* đã tồn tại */ }
execSync(`npx prisma db execute --url "${DB}" --stdin`, { input: "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;", env, stdio: ["pipe", "ignore", "inherit"] });
execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
rmSync(".test-storage/e2e", { recursive: true, force: true });

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", PORT], { env, stdio: ["ignore", "ignore", "inherit"], detached: true });
let code = 1;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  execSync("npx tsx tests/e2e/e2e.ts", { env: { ...env, BASE_URL: `http://localhost:${PORT}` }, stdio: "inherit" });
  code = 0;
} catch {
  code = 1;
} finally {
  try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
}
process.exit(code);
