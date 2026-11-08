// Kiểm tra trên link PREVIEW thật: đăng nhập, tạo công ty, upload XML (dữ liệu tổng hợp), dữ liệu còn sau khi đăng nhập lại.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { buildInvoiceXml } from "../fixtures/build-invoice";

const state = JSON.parse(readFileSync(process.env.DEPLOY_STATE ?? ".deploy-state.json", "utf8"));
const BASE: string = state.url;
const TAX = "0109998877"; // MST tổng hợp cho kiểm thử preview
const dir = path.resolve("test-results/preview");
mkdirSync(dir, { recursive: true });
const xmlPath = path.join(dir, "HD-PREVIEW-1.xml");
writeFileSync(xmlPath, buildInvoiceXml({ sellerTax: "0300000099", buyerTax: TAX, number: "1", date: "2026-11-01", lines: [
  { name: "Nguyên liệu kiểm thử", unit: "kg", qty: "12.5", price: "80000", amount: "1000000", rate: "10%" },
  { name: "Dịch vụ kiểm thử", amount: "500000", rate: "8%" },
] }));

const results: [string, boolean, string?][] = [];
async function step(name: string, fn: () => Promise<void>) {
  try { await fn(); results.push([name, true]); console.log("  ✓", name); }
  catch (e) { results.push([name, false, (e as Error).message]); console.log("  ✗", name, "\n    ", (e as Error).message.split("\n")[0]); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, extraHTTPHeaders: { "x-vercel-protection-bypass": state.bypass, "x-vercel-set-bypass-cookie": "true" } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const login = async () => {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "admin@fdi.local");
  await page.fill("#password", state.adminPassword);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
};
console.log("Preview smoke –", BASE);
await step("Health: website + database PostgreSQL hoạt động", async () => {
  const r = await page.request.get(`${BASE}/api/health`);
  assert.equal(r.status(), 200);
  assert.deepEqual(await r.json(), { ok: true, db: "up" });
});
await step("Header bảo mật (CSP, X-Frame-Options, HSTS)", async () => {
  const r = await page.request.get(`${BASE}/login`);
  const h = r.headers();
  assert.ok(h["content-security-policy"]); assert.equal(h["x-frame-options"], "SAMEORIGIN"); assert.ok(h["strict-transport-security"]);
});
await step("Chưa đăng nhập: API trả 401", async () => {
  const r = await page.request.get(`${BASE}/api/companies`);
  assert.equal(r.status(), 401);
});
await step("Đăng nhập Quản trị hệ thống", login);
await step("Tạo công ty (hoặc đã có từ lần chạy trước)", async () => {
  await page.goto(`${BASE}/companies`);
  if (await page.getByText(TAX).count()) return;
  await page.click("[data-testid=add-company]");
  const f = page.locator("[data-testid=company-form]");
  await f.locator("[name=taxCode]").fill(TAX);
  await f.locator("[name=name]").fill("CÔNG TY KIỂM THỬ PREVIEW (dữ liệu tổng hợp)");
  await f.locator("[name=address]").fill("Địa chỉ kiểm thử");
  await f.locator("button[type=submit]").click();
  await page.locator("[data-testid=companies-table]").getByText(TAX).waitFor();
});
await step("Chọn công ty và kỳ năm 2026", async () => {
  const opt = page.locator("[data-testid=company-select] option", { hasText: TAX });
  await page.selectOption("[data-testid=company-select]", await opt.getAttribute("value"));
  await page.waitForTimeout(1500);
  await page.selectOption("select[aria-label='Loại kỳ']", "year");
  await page.waitForTimeout(1500);
  await page.selectOption("select[aria-label='Năm']", "2026");
  await page.waitForTimeout(1500);
});
await step("Upload XML → xử lý nền → thành công hoặc trùng (lần chạy lại)", async () => {
  await page.goto(`${BASE}/imports`);
  await page.setInputFiles("[data-testid=file-input]", [xmlPath]);
  await page.click("[data-testid=upload-btn]");
  await page.locator("[data-testid=job-progress]").getByText("Hoàn tất").waitFor({ timeout: 120000 });
  const ok = await page.locator("[data-testid=count-success]").innerText();
  const dup = await page.locator("[data-testid=count-duplicate]").innerText();
  assert.ok(/: 1/.test(ok) || /: 1/.test(dup), `${ok} / ${dup}`);
  await page.screenshot({ path: `${dir}/upload.png`, fullPage: true });
});
await step("Hóa đơn hiển thị đúng (mua vào, 2 dòng hàng, thuế 10% + 8%)", async () => {
  await page.goto(`${BASE}/invoices`);
  await page.locator("[data-testid=invoice-row]").first().click();
  const dlg = page.locator("[data-testid=invoice-dialog]");
  await dlg.getByText("Mua vào").first().waitFor();
  await dlg.getByRole("tab", { name: /Hàng hóa/ }).click();
  assert.equal(await dlg.locator("[data-testid=lines-table] tbody tr").count(), 2);
  await dlg.getByRole("tab", { name: /Thuế/ }).click();
  const t = await dlg.locator("[data-testid=tax-table]").innerText();
  assert.match(t, /10%/); assert.match(t, /8%/);
  await page.screenshot({ path: `${dir}/invoice.png` });
});
await step("Đăng xuất, đăng nhập lại: dữ liệu vẫn còn (lưu trên PostgreSQL)", async () => {
  await page.keyboard.press("Escape");
  await page.click("[data-testid=user-menu]");
  await page.getByText("Đăng xuất").click();
  await page.waitForURL("**/login");
  await ctx.clearCookies();
  await login();
  await page.goto(`${BASE}/invoices`);
  await page.locator("[data-testid=invoice-row]").first().waitFor();
});
await browser.close();
writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2));
const fail = results.filter((r) => !r[1]).length;
console.log(`\nPreview: ${results.length - fail}/${results.length} đạt`);
process.exit(fail ? 1 : 0);
