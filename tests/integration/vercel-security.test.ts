import { describe, expect, it, beforeAll } from "vitest";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { createEmptyJob, addChunk, commitJob, processImportJob, claimNextJob, CHUNK_BYTES } from "@/server/services/imports";
import { login, LOGIN_MAX_FAILS } from "@/server/services/users";
import { buildInvoiceXml } from "../fixtures/build-invoice";
import { makeUser, makeCompany, addRole, uniqTax } from "../helpers";
import type { Actor } from "@/server/auth/session";

let A: Awaited<ReturnType<typeof makeCompany>>;
let B: Awaited<ReturnType<typeof makeCompany>>;
let ua: Actor;
let ub: Actor;

beforeAll(async () => {
  A = await makeCompany(uniqTax(), "Chunk A");
  B = await makeCompany(uniqTax(), "Chunk B");
  ua = await makeUser();
  ub = await makeUser();
  await addRole(ua.id, A.id, "EDITOR");
  await addRole(ub.id, B.id, "EDITOR");
});

async function sendFile(actor: Actor, companyId: string, jobId: string, name: string, data: Buffer) {
  const parts = Math.max(1, Math.ceil(data.length / CHUNK_BYTES));
  const uploadId = `u${Math.random().toString(36).slice(2)}`;
  // gửi ngược thứ tự để chắc chắn ghép đúng
  let last;
  for (let i = parts - 1; i >= 0; i--)
    last = await addChunk(actor, companyId, jobId, { uploadId, index: i, total: parts, fileName: name, data: data.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES) });
  return last;
}

describe("Tải lên theo từng phần (Vercel ≤ 4,5MB/request)", () => {
  it("ZIP lớn hơn 1 phần được ghép đúng và xử lý từng file", async () => {
    const zip = new JSZip();
    for (let i = 1; i <= 40; i++)
      zip.file(`HD${i}.xml`, buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0377000001", number: String(5000 + i), lines: [{ name: "X".repeat(20), amount: "1000", rate: "10%" }] }));
    // thêm file đệm ngẫu nhiên (không nén được) để ZIP > 1 phần
    const { randomBytes } = await import("node:crypto");
    zip.file("dem.bin", randomBytes(CHUNK_BYTES + 500_000));
    const data = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    expect(data.length).toBeGreaterThan(CHUNK_BYTES);
    const job = await createEmptyJob(ua, A.id);
    // job đang UPLOADING không được worker nhận
    expect(await prisma.importJob.findUnique({ where: { id: job.id } }).then((j) => j?.status)).toBe("UPLOADING");
    const r = await sendFile(ua, A.id, job.id, "lo-lon.zip", data);
    expect(r?.complete).toBe(true);
    expect(await prisma.uploadChunk.count({ where: { jobId: job.id } })).toBe(0);
    await commitJob(ua, A.id, job.id);
    await processImportJob(job.id);
    const done = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(done.status).toBe("COMPLETED");
    expect(done.successCount).toBe(41); // zip + 40 xml
    const stored = await prisma.importItem.findFirstOrThrow({ where: { jobId: job.id, fileName: "lo-lon.zip" }, include: {} });
    const f = await prisma.storedFile.findUniqueOrThrow({ where: { id: stored.fileId! } });
    expect(f.size).toBe(data.length);
  });

  it("người công ty B không thể gửi phần file hay xác nhận lượt nhập của công ty A", async () => {
    const job = await createEmptyJob(ua, A.id);
    const piece = { uploadId: "x1", index: 0, total: 1, fileName: "a.xml", data: Buffer.from("<a/>") };
    await expect(addChunk(ub, A.id, job.id, piece)).rejects.toMatchObject({ status: 404 });
    await expect(addChunk(ub, B.id, job.id, piece)).rejects.toMatchObject({ status: 404 });
    await expect(commitJob(ub, B.id, job.id)).rejects.toMatchObject({ status: 404 });
  });

  it("không nhận thêm file sau khi đã xác nhận; lượt nhập rỗng không được xác nhận", async () => {
    const job = await createEmptyJob(ua, A.id);
    await expect(commitJob(ua, A.id, job.id)).rejects.toMatchObject({ status: 400 });
    await sendFile(ua, A.id, job.id, "a.xml", Buffer.from(buildInvoiceXml({ sellerTax: A.taxCode, buyerTax: "0377000001", number: "9999", lines: [{ name: "Y", amount: "1", rate: "10%" }] })));
    await commitJob(ua, A.id, job.id);
    await expect(sendFile(ua, A.id, job.id, "b.xml", Buffer.from("<b/>"))).rejects.toMatchObject({ status: 409 });
    while (await claimNextJob().then(async (id) => (id ? (await processImportJob(id), true) : false)));
  });

  it("phần tải lên vượt kích thước bị từ chối", async () => {
    const job = await createEmptyJob(ua, A.id);
    await expect(addChunk(ua, A.id, job.id, { uploadId: "big", index: 0, total: 1, fileName: "x.zip", data: Buffer.alloc(CHUNK_BYTES + 1) })).rejects.toMatchObject({ status: 400 });
  });
});

describe("Chống dò mật khẩu", () => {
  it(`khóa tạm sau ${LOGIN_MAX_FAILS} lần sai, kể cả khi sau đó nhập đúng`, async () => {
    const email = `brute${Date.now()}@test.local`;
    await makeUser({ email, password: "DungMatKhau1" });
    for (let i = 0; i < LOGIN_MAX_FAILS; i++) await expect(login(email, "sai")).rejects.toMatchObject({ status: 400 });
    await expect(login(email, "DungMatKhau1")).rejects.toMatchObject({ status: 429 });
    await expect(login(email.toUpperCase(), "DungMatKhau1")).rejects.toMatchObject({ status: 429 });
  });
});
