// Triển khai PREVIEW lên Vercel + database Neon (không triển khai production).
// Khóa API được proxy của môi trường cloud gắn vào request – script không đọc/ghi khóa thật.
// Chạy: node scripts/deploy-preview.mjs
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "node:fs";

const NEON = "https://console.neon.tech/api/v2";
const VC = "https://api.vercel.com";
const PROJECT = "fdi-invoice-pro";
const NEON_PROJECT = "fdi-invoice-preview";
const ALIAS = "fdi-invoice-pro-preview-lewan.vercel.app";
const STATE = process.env.DEPLOY_STATE ?? ".deploy-state.json"; // không commit (chứa bí mật preview)
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
const save = () => writeFileSync(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });

async function call(base, path, init = {}) {
  const r = await fetch(base + path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (!r.ok && !(init.okStatus ?? []).includes(r.status)) throw new Error(`${init.method ?? "GET"} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  return { status: r.status, data };
}
const clean = (u) => u.replace(/[&?]channel_binding=[a-z]*/, "");

// 1) Neon
let neonId = state.neonProjectId;
if (!neonId) {
  const { data } = await call(NEON, "/projects?limit=100");
  neonId = data.projects.find((p) => p.name === NEON_PROJECT)?.id;
  if (!neonId) {
    const created = await call(NEON, "/projects", { method: "POST", body: JSON.stringify({ project: { name: NEON_PROJECT, region_id: "aws-ap-southeast-1", pg_version: 16 } }) });
    neonId = created.data.project.id;
    console.log("✔ Đã tạo Neon project", neonId);
    await new Promise((r) => setTimeout(r, 5000));
  }
  state.neonProjectId = neonId; save();
}
const db = (await call(NEON, `/projects/${neonId}/databases`)).data.databases[0];
const q = `database_name=${db.name}&role_name=${db.owner_name}`;
const direct = clean((await call(NEON, `/projects/${neonId}/connection_uri?${q}&pooled=false`)).data.uri);
const pooled = clean((await call(NEON, `/projects/${neonId}/connection_uri?${q}&pooled=true`)).data.uri);
const sep = pooled.includes("?") ? "&" : "?";
console.log("✔ Neon sẵn sàng (Singapore), DB:", db.name);

// 2) Vercel project
let proj = await call(VC, `/v9/projects/${PROJECT}`, { okStatus: [404] });
if (proj.status === 404) proj = await call(VC, "/v11/projects", { method: "POST", body: JSON.stringify({ name: PROJECT, framework: "nextjs" }) });
const projectId = proj.data.id;
console.log("✔ Vercel project", projectId);

// 3) Biến môi trường bí mật – CHỈ cho môi trường preview
state.adminPassword ??= "Pv-" + randomBytes(9).toString("base64url") + "9a";
save();
const env = {
  DATABASE_URL: `${pooled}${sep}pgbouncer=true&connection_limit=3`,
  DIRECT_URL: direct,
  STORAGE_DRIVER: "db",
  JOB_MODE: "inline",
  COOKIE_SECURE: "true",
  SEED_ADMIN_EMAIL: "admin@fdi.local",
  SEED_ADMIN_PASSWORD: state.adminPassword,
};
await call(VC, `/v10/projects/${projectId}/env?upsert=true`, {
  method: "POST",
  body: JSON.stringify(Object.entries(env).map(([key, value]) => ({ key, value, type: "encrypted", target: ["preview"] }))),
});
console.log("✔ Đã đặt biến môi trường preview:", Object.keys(env).join(", "));

// 4) Deploy preview bằng Vercel CLI (proxy gắn token thật vào request)
mkdirSync(".vercel", { recursive: true });
writeFileSync(".vercel/project.json", JSON.stringify({ projectId, orgId: proj.data.accountId }));
const cliEnv = { ...process.env, VERCEL_TELEMETRY_DISABLED: "1" };
const out = execSync(`npx --yes vercel@50 deploy --yes --target preview --token proxy-injected`, { env: cliEnv, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 50e6 });
const url = out.trim().split("\n").pop().trim();
console.log("✔ Deployment:", url);
const dep = (await call(VC, `/v13/deployments/${new URL(url).host}`)).data;
if (dep.readyState !== "READY") throw new Error(`Deployment chưa sẵn sàng: ${dep.readyState}`);

// 5) Alias cố định
await call(VC, `/v2/deployments/${dep.id}/aliases`, { method: "POST", body: JSON.stringify({ alias: ALIAS }) });
console.log("✔ Alias:", `https://${ALIAS}`);

// 6) Bypass cho kiểm thử tự động (preview vẫn được Vercel bảo vệ với người ngoài)
const pb = await call(VC, `/v1/projects/${projectId}/protection-bypass`, { method: "PATCH", body: JSON.stringify({}) });
state.bypass = Object.keys(pb.data.protectionBypass ?? {})[0];
state.url = `https://${ALIAS}`;
state.deploymentUrl = url;
save();
console.log("✔ Hoàn tất. Trạng thái lưu tại", STATE);
