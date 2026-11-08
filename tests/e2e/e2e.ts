import { chromium, type Page } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { buildInvoiceXml, fakePdf } from "../fixtures/build-invoice";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const ALPHA = "0109990001";
const BETA = "0109990002";
const tmp = path.resolve(".test-storage/e2e-files");
mkdirSync(tmp, { recursive: true });
const shots = path.resolve("test-results/screenshots");
mkdirSync(shots, { recursive: true });

const results: { name: string; ok: boolean; err?: string }[] = [];
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: (e as Error).message });
    console.log(`  ✗ ${name}\n     ${(e as Error).message.split("\n")[0]}`);
  }
}

async function login(page: Page, email: string, pw: string) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", pw);
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
}
async function logout(page: Page) {
  await page.click("[data-testid=user-menu]");
  await page.getByText("Đăng xuất").click();
  await page.waitForURL("**/login");
}

async function main() {
  // Fixture tổng hợp
  const f1 = path.join(tmp, "HD0001.xml");
  writeFileSync(f1, buildInvoiceXml({ sellerTax: ALPHA, buyerTax: "0388000001", number: "1", date: "2026-03-05", lines: [
    { name: "Linh kiện A", unit: "cái", qty: "10", price: "100000", amount: "1000000", rate: "10%" },
    { name: "Dịch vụ lắp đặt", unit: "lần", qty: "1", price: "500000", amount: "500000", rate: "8%" },
    { name: "Bảo hiểm hàng hóa", amount: "200000", rate: "KCT" },
  ] }));
  writeFileSync(path.join(tmp, "HD0001.pdf"), fakePdf("HD0001"));
  const zip = new JSZip();
  for (let i = 10; i < 13; i++) zip.file(`HD${i}.xml`, buildInvoiceXml({ sellerTax: "0388000002", buyerTax: ALPHA, number: String(i), date: "2026-03-20", lines: [{ name: `Nguyên liệu ${i}`, amount: "300000", rate: "10%" }] }));
  zip.file("hong.xml", "<HDon><DLHDon>");
  const fz = path.join(tmp, "lo-thang-3.zip");
  writeFileSync(fz, await zip.generateAsync({ type: "nodebuffer" }));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  console.log("E2E – FDI Invoice & Tax Automation Pro");

  await step("Đăng nhập sai mật khẩu hiển thị lỗi kèm hướng khắc phục", async () => {
    await page.goto(`${BASE}/login`);
    await page.fill("#email", "admin@fdi.local");
    await page.fill("#password", "sai");
    await page.click("button[type=submit]");
    const alert = page.getByRole("alert").filter({ hasText: "không đúng" });
    await alert.waitFor();
    const t = await alert.innerText();
    assert.match(t, /không đúng/);
    assert.match(t, /Cách khắc phục/);
  });

  await step("Chưa đăng nhập bị chuyển về trang đăng nhập", async () => {
    await page.goto(`${BASE}/invoices`);
    await page.waitForURL("**/login");
  });

  await step("System Admin đăng nhập, tạo công ty mới qua giao diện", async () => {
    await login(page, "admin@fdi.local", "Admin@12345");
    await page.screenshot({ path: `${shots}/01-dashboard-admin.png` });
    await page.goto(`${BASE}/companies`);
    await page.click("[data-testid=add-company]");
    const form = page.locator("[data-testid=company-form]");
    await form.locator("[name=taxCode]").fill("0109990003");
    await form.locator("[name=name]").fill("CÔNG TY TNHH GAMMA E2E");
    await form.locator("[name=address]").fill("KCN E2E");
    await form.locator("button[type=submit]").click();
    await page.locator("[data-testid=companies-table]").getByText("CÔNG TY TNHH GAMMA E2E").waitFor();
    await page.screenshot({ path: `${shots}/02-companies.png` });
  });

  await step("Tạo công ty trùng MST báo lỗi rõ ràng", async () => {
    await page.click("[data-testid=add-company]");
    const form = page.locator("[data-testid=company-form]");
    await form.locator("[name=taxCode]").fill("0109990003");
    await form.locator("[name=name]").fill("Trùng");
    await form.locator("[name=address]").fill("abc");
    await form.locator("button[type=submit]").click();
    await form.getByRole("alert").getByText(/đã tồn tại/).waitFor();
    await page.keyboard.press("Escape");
    await logout(page);
  });

  await step("Kế toán Alpha: kéo thả XML + PDF + ZIP, thanh tiến trình, báo cáo từng file", async () => {
    await login(page, `ketoan.${ALPHA}@demo.local`, "Demo@12345");
    await page.goto(`${BASE}/imports`);
    await page.setInputFiles("[data-testid=file-input]", [f1, path.join(tmp, "HD0001.pdf"), fz]);
    await page.click("[data-testid=upload-btn]");
    await page.locator("[data-testid=job-progress]").getByText("Hoàn tất").waitFor({ timeout: 30000 });
    const ok = await page.locator("[data-testid=count-success]").innerText();
    const er = await page.locator("[data-testid=count-error]").innerText();
    assert.match(ok, /Thành công: 6/); // 1 xml + 1 pdf + zip + 3 xml
    assert.match(er, /Lỗi: 1/);
    await page.screenshot({ path: `${shots}/03-import-result.png`, fullPage: true });
  });

  await step("Tải lại cùng file → báo trùng, không tạo bản ghi mới", async () => {
    await page.goto(`${BASE}/imports`);
    await page.setInputFiles("[data-testid=file-input]", [f1]);
    await page.click("[data-testid=upload-btn]");
    await page.locator("[data-testid=job-progress]").getByText("Hoàn tất").waitFor({ timeout: 30000 });
    assert.match(await page.locator("[data-testid=count-duplicate]").innerText(), /Trùng: 1/);
  });

  await step("Danh sách hóa đơn theo kỳ, mở modal xem chi tiết (hàng hóa, thuế, XML/PDF)", async () => {
    await page.goto(`${BASE}/invoices`);
    await page.locator("[data-testid=invoice-row]").first().waitFor();
    assert.equal(await page.locator("[data-testid=invoice-row]").count(), 4);
    await page.locator("[data-testid=invoice-row]").filter({ hasText: "0388000001" }).click();
    const dlg = page.locator("[data-testid=invoice-dialog]");
    await dlg.getByText("Người bán").waitFor();
    await page.screenshot({ path: `${shots}/04-invoice-detail.png` });
    await dlg.getByRole("tab", { name: /Hàng hóa/ }).click();
    assert.equal(await dlg.locator("[data-testid=lines-table] tbody tr").count(), 3);
    await dlg.getByRole("tab", { name: /Thuế/ }).click();
    const tax = await dlg.locator("[data-testid=tax-table]").innerText();
    assert.match(tax, /10%/); assert.match(tax, /8%/); assert.match(tax, /KCT/);
    await dlg.getByRole("tab", { name: /XML/ }).click();
    await dlg.locator("[data-testid=xml-view]").getByText(/KHMSHDon/).waitFor();
    assert.equal(await dlg.locator("iframe[title='PDF hóa đơn']").count(), 1);
    await page.screenshot({ path: `${shots}/05-invoice-xml-pdf.png` });
    await page.keyboard.press("Escape");
  });

  await step("Lọc mua vào & tìm kiếm", async () => {
    await page.selectOption("[data-testid=filter-direction]", "PURCHASE");
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=invoice-row]").length === 3);
    await page.fill("[data-testid=search-input]", "11");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelectorAll("[data-testid=invoice-row]").length === 1);
  });

  await step("Xuất Excel chỉ chứa dữ liệu công ty Alpha", async () => {
    const companyId = (await ctx.cookies()).find((c) => c.name === "fdi_company")?.value ?? (await page.locator("[data-testid=company-select]").inputValue());
    const res = await page.request.get(`${BASE}/api/export?companyId=${companyId}&period=2026`);
    assert.equal(res.status(), 200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Hoa don")!;
    let n = 0;
    ws.eachRow((r, i) => {
      if (i > 4 && typeof r.getCell(1).value === "number") {
        n++;
        assert.ok(String(r.getCell(9).value) === ALPHA || String(r.getCell(11).value) === ALPHA);
      }
    });
    assert.equal(n, 4);
  });

  let alphaInvoiceUrl = "";
  await step("Đăng xuất, đăng nhập lại → dữ liệu còn nguyên", async () => {
    const companyId = await page.locator("[data-testid=company-select]").inputValue();
    const r = await page.request.get(`${BASE}/api/invoices?companyId=${companyId}&period=2026`);
    const first = (await r.json()).rows[0].id;
    alphaInvoiceUrl = `${BASE}/api/invoices/${first}?companyId=${companyId}`;
    await logout(page);
    await login(page, `ketoan.${ALPHA}@demo.local`, "Demo@12345");
    await page.goto(`${BASE}/invoices`);
    await page.locator("[data-testid=invoice-row]").first().waitFor();
    assert.equal(await page.locator("[data-testid=invoice-row]").count(), 4);
    await page.goto(`${BASE}/dashboard`);
    await page.screenshot({ path: `${shots}/06-dashboard-data.png`, fullPage: true });
    await logout(page);
  });

  await step("Viewer Alpha: thấy dữ liệu nhưng không được nhập hóa đơn", async () => {
    await login(page, `xem.${ALPHA}@demo.local`, "Demo@12345");
    await page.goto(`${BASE}/imports`);
    await page.getByText(/chỉ có quyền xem/).waitFor();
    assert.equal(await page.locator("[data-testid=dropzone]").count(), 0);
    await logout(page);
  });

  await step("Kế toán Beta: không thấy và không truy cập được dữ liệu Alpha (tenant isolation)", async () => {
    await login(page, `ketoan.${BETA}@demo.local`, "Demo@12345");
    const opts = await page.locator("[data-testid=company-select] option").allInnerTexts();
    assert.equal(opts.length, 1);
    assert.ok(opts[0].includes(BETA));
    await page.goto(`${BASE}/invoices`);
    await page.getByText("Không có hóa đơn phù hợp").waitFor();
    const r = await page.request.get(alphaInvoiceUrl);
    assert.equal(r.status(), 404);
    const alphaCompany = new URL(alphaInvoiceUrl).searchParams.get("companyId");
    const r2 = await page.request.get(`${BASE}/api/export?companyId=${alphaCompany}`);
    assert.equal(r2.status(), 404);
    const r3 = await page.request.post(`${BASE}/api/workspace`, { data: { companyId: alphaCompany } });
    assert.equal(r3.status(), 404);
  });

  await step("Dark mode bật/tắt", async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.getByLabel("Chuyển giao diện sáng/tối").click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), true);
    await page.screenshot({ path: `${shots}/07-dark-mode.png` });
    await page.reload();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), true);
  });

  await step("Module chưa triển khai hiển thị 'Đang phát triển', không có nút thao tác giả", async () => {
    await page.goto(`${BASE}/modules/vat-return`);
    await page.getByText("Đang phát triển").first().waitFor();
    assert.equal(await page.locator("main button").count(), 0);
  });

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  writeFileSync("test-results/e2e-results.json", JSON.stringify(results, null, 2));
  console.log(`\nE2E: ${results.length - failed.length}/${results.length} đạt`);
  if (failed.length) process.exit(1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
