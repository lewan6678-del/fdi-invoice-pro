import path from "node:path";
import JSZip from "jszip";
import type { FileKind, Prisma } from "@prisma/client";
import { Prisma as P } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Errors } from "@/lib/errors";
import { InvoiceParseError, looksLikeInvoiceXml, parseInvoiceXml } from "../parser/invoice-xml";
import { storage, sha256, storageKeyFor } from "../storage";
import { audit } from "../audit";
import { requireCompanyRole } from "../auth/rbac";
import type { Actor } from "../auth/session";

export const LIMITS = {
  maxFileBytes: 50 * 1024 * 1024,
  maxFilesPerUpload: 500,
  maxZipEntries: 3000,
  maxZipUncompressedBytes: 800 * 1024 * 1024,
};

export interface UploadFile {
  name: string;
  data: Buffer;
}

const MIME: Record<FileKind, string> = { XML: "application/xml", PDF: "application/pdf", ZIP: "application/zip", OTHER: "application/octet-stream" };

export function detectKind(name: string, data: Buffer): FileKind {
  const ext = path.extname(name).toLowerCase();
  if (data.subarray(0, 4).toString("binary") === "PK\x03\x04") return "ZIP";
  if (data.subarray(0, 5).toString("binary") === "%PDF-") return "PDF";
  if (ext === ".xml" || looksLikeInvoiceXml(data)) return "XML";
  if (ext === ".zip") return "ZIP";
  if (ext === ".pdf") return "PDF";
  return "OTHER";
}

async function storeFile(companyId: string, actorId: string | null, name: string, data: Buffer, kind: FileKind) {
  const hash = sha256(data);
  const existing = await prisma.storedFile.findUnique({ where: { companyId_sha256: { companyId, sha256: hash } } });
  if (existing) return existing;
  const key = storageKeyFor(companyId, hash, kind === "OTHER" ? "" : "." + kind.toLowerCase());
  await storage().putIfAbsent(key, data, MIME[kind]);
  try {
    return await prisma.storedFile.create({
      data: { companyId, kind, originalName: name.slice(0, 500), storageKey: key, sha256: hash, size: data.length, mimeType: MIME[kind], uploadedById: actorId },
    });
  } catch (e) {
    if (e instanceof P.PrismaClientKnownRequestError && e.code === "P2002")
      return prisma.storedFile.findUniqueOrThrow({ where: { companyId_sha256: { companyId, sha256: hash } } });
    throw e;
  }
}

export const CHUNK_BYTES = 3 * 1024 * 1024; // < 4,5MB giới hạn request của Vercel

async function assertCanImport(actor: Actor, companyId: string) {
  await requireCompanyRole(actor, companyId, "EDITOR");
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
  if (!company.isActive) throw Errors.validation("Công ty đang ở trạng thái ngừng hoạt động.", "Kích hoạt lại công ty trong mục Quản lý công ty trước khi nhập hóa đơn.");
}

/** Bước 1a: tạo lượt nhập rỗng (trạng thái UPLOADING). */
export async function createEmptyJob(actor: Actor, companyId: string) {
  await assertCanImport(actor, companyId);
  return prisma.importJob.create({ data: { companyId, createdById: actor.id, status: "UPLOADING" } });
}

async function getUploadingJob(actor: Actor, companyId: string, jobId: string) {
  await assertCanImport(actor, companyId);
  const job = await prisma.importJob.findFirst({ where: { id: jobId, companyId } });
  if (!job) throw Errors.notFound("Lượt nhập");
  if (job.status !== "UPLOADING") throw Errors.conflict("Lượt nhập đã được xác nhận, không thể thêm file.", "Tạo lượt nhập mới.");
  return job;
}

/** Bước 1b: thêm một file hoàn chỉnh vào lượt nhập (lưu file gốc bất biến + tạo dòng chờ xử lý). */
export async function addFileToJob(actor: Actor, companyId: string, jobId: string, f: UploadFile) {
  await getUploadingJob(actor, companyId, jobId);
  const order = await prisma.importItem.count({ where: { jobId } });
  const kind = detectKind(f.name, f.data);
  const base = { jobId, companyId, fileName: f.name.slice(0, 500), kind, sortOrder: order };
  if (f.data.length > LIMITS.maxFileBytes)
    return prisma.importItem.create({ data: { ...base, status: "ERROR", errorCode: "FILE_TOO_LARGE", message: `File vượt quá ${LIMITS.maxFileBytes / 1024 / 1024}MB.`, hint: "Chia nhỏ file ZIP.", processedAt: new Date() } });
  if (kind === "OTHER")
    return prisma.importItem.create({ data: { ...base, status: "ERROR", errorCode: "UNSUPPORTED_TYPE", message: "Định dạng file không được hỗ trợ.", hint: "Chỉ hỗ trợ .xml, .pdf, .zip.", processedAt: new Date() } });
  if (order >= LIMITS.maxFilesPerUpload) throw Errors.validation(`Tối đa ${LIMITS.maxFilesPerUpload} file mỗi lần.`, "Nén thành file ZIP hoặc chia thành nhiều lần tải.");
  const stored = await storeFile(companyId, actor.id, f.name, f.data, kind);
  return prisma.importItem.create({ data: { ...base, fileId: stored.id } });
}

/** Bước 1b': nhận một phần của file lớn; khi đủ phần thì ghép và thêm vào lượt nhập. */
export async function addChunk(actor: Actor, companyId: string, jobId: string, c: { uploadId: string; index: number; total: number; fileName: string; data: Buffer }) {
  await getUploadingJob(actor, companyId, jobId);
  if (!/^[\w-]{1,64}$/.test(c.uploadId) || !Number.isInteger(c.index) || !Number.isInteger(c.total) || c.total < 1 || c.index < 0 || c.index >= c.total)
    throw Errors.validation("Thông tin phần tải lên không hợp lệ.");
  if (c.total * CHUNK_BYTES > LIMITS.maxFileBytes + CHUNK_BYTES) throw Errors.validation(`File vượt quá ${LIMITS.maxFileBytes / 1024 / 1024}MB.`, "Chia nhỏ file ZIP.");
  if (c.data.length > CHUNK_BYTES) throw Errors.validation("Phần tải lên quá lớn.");
  await prisma.uploadChunk.upsert({
    where: { jobId_uploadId_index: { jobId, uploadId: c.uploadId, index: c.index } },
    update: {},
    create: { jobId, companyId, uploadId: c.uploadId, index: c.index, total: c.total, fileName: c.fileName.slice(0, 500), data: new Uint8Array(c.data) },
  });
  const have = await prisma.uploadChunk.count({ where: { jobId, uploadId: c.uploadId } });
  if (have < c.total) return { complete: false as const };
  const parts = await prisma.uploadChunk.findMany({ where: { jobId, uploadId: c.uploadId }, orderBy: { index: "asc" } });
  const deleted = await prisma.uploadChunk.deleteMany({ where: { jobId, uploadId: c.uploadId } });
  if (deleted.count < c.total) return { complete: false as const }; // request song song khác đã ghép
  const item = await addFileToJob(actor, companyId, jobId, { name: c.fileName, data: Buffer.concat(parts.map((p) => Buffer.from(p.data))) });
  return { complete: true as const, itemId: item.id };
}

/** Bước 1c: xác nhận đã tải xong → chuyển sang chờ xử lý nền. */
export async function commitJob(actor: Actor, companyId: string, jobId: string) {
  const job = await getUploadingJob(actor, companyId, jobId);
  await prisma.uploadChunk.deleteMany({ where: { jobId } });
  const n = await prisma.importItem.count({ where: { jobId } });
  if (n === 0) throw Errors.validation("Chưa có file nào được tải lên.", "Kéo thả file XML/PDF/ZIP vào khung tải lên.");
  await prisma.importJob.update({ where: { id: job.id }, data: { status: "PENDING" } });
  await refreshJobCounters(jobId);
  await audit(actor, "import.create", { companyId, entityType: "import_job", entityId: jobId, detail: { files: n } });
  return prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
}

/** Tải lên một lần (dùng cho máy chủ thường & kiểm thử): tạo → thêm file → xác nhận. */
export async function createImportJob(actor: Actor, companyId: string, files: UploadFile[]) {
  await assertCanImport(actor, companyId);
  if (files.length === 0) throw Errors.validation("Chưa chọn file nào.", "Kéo thả file XML/PDF/ZIP vào khung tải lên.");
  if (files.length > LIMITS.maxFilesPerUpload) throw Errors.validation(`Tối đa ${LIMITS.maxFilesPerUpload} file mỗi lần.`, "Nén thành file ZIP hoặc chia thành nhiều lần tải.");
  const job = await createEmptyJob(actor, companyId);
  for (const f of files) await addFileToJob(actor, companyId, job.id, f);
  return commitJob(actor, companyId, job.id);
}

export async function refreshJobCounters(jobId: string) {
  const groups = await prisma.importItem.groupBy({ by: ["status"], where: { jobId }, _count: true });
  const c = (s: string) => groups.find((g) => g.status === s)?._count ?? 0;
  const total = groups.reduce((a, g) => a + g._count, 0);
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      totalItems: total,
      processedItems: total - c("PENDING"),
      successCount: c("SUCCESS"),
      duplicateCount: c("DUPLICATE"),
      errorCount: c("ERROR"),
      heartbeatAt: new Date(),
    },
  });
}

type ItemResult = { status: "SUCCESS" | "DUPLICATE" | "ERROR" | "SKIPPED"; errorCode?: string; message: string; hint?: string; invoiceId?: string };

/** Giải nén ZIP: mỗi file con là một ImportItem độc lập. */
async function expandZip(item: { id: string; jobId: string; companyId: string; fileName: string; fileId: string | null }, actorId: string | null): Promise<ItemResult> {
  const f = await prisma.storedFile.findUniqueOrThrow({ where: { id: item.fileId! } });
  const buf = await storage().get(f.storageKey);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return { status: "ERROR", errorCode: "BAD_ZIP", message: "File ZIP bị hỏng hoặc có mật khẩu.", hint: "Nén lại file bằng định dạng ZIP chuẩn, không đặt mật khẩu." };
  }
  const entries = Object.values(zip.files).filter((e) => !e.dir && !/(^|\/)(__MACOSX|\.)/.test(e.name));
  if (entries.length === 0) return { status: "ERROR", errorCode: "EMPTY_ZIP", message: "File ZIP không chứa file nào.", hint: "Kiểm tra lại file nén." };
  if (entries.length > LIMITS.maxZipEntries) return { status: "ERROR", errorCode: "ZIP_TOO_MANY", message: `ZIP có ${entries.length} file, vượt giới hạn ${LIMITS.maxZipEntries}.`, hint: "Chia thành nhiều file ZIP nhỏ hơn." };
  let totalBytes = 0;
  let order = 0;
  const base = await prisma.importItem.findUniqueOrThrow({ where: { id: item.id }, select: { sortOrder: true } });
  for (const e of entries) {
    const childName = e.name;
    const data = await e.async("nodebuffer");
    totalBytes += data.length;
    if (totalBytes > LIMITS.maxZipUncompressedBytes)
      return { status: "ERROR", errorCode: "ZIP_TOO_LARGE", message: "Dung lượng giải nén vượt giới hạn an toàn.", hint: "Chia thành nhiều file ZIP nhỏ hơn." };
    const childKind = detectKind(childName, data);
    const common = { jobId: item.jobId, companyId: item.companyId, fileName: childName, archiveName: item.fileName, kind: childKind, sortOrder: base.sortOrder * 10000 + ++order };
    if (childKind === "ZIP") {
      await prisma.importItem.create({ data: { ...common, status: "SKIPPED", message: "ZIP lồng trong ZIP không được giải nén.", hint: "Giải nén ZIP con và tải lên riêng.", processedAt: new Date() } });
    } else if (childKind === "OTHER") {
      await prisma.importItem.create({ data: { ...common, status: "SKIPPED", errorCode: "UNSUPPORTED_TYPE", message: "Bỏ qua: không phải XML/PDF.", processedAt: new Date() } });
    } else {
      const stored = await storeFile(item.companyId, actorId, path.basename(childName), data, childKind);
      await prisma.importItem.create({ data: { ...common, fileId: stored.id } });
    }
  }
  return { status: "SUCCESS", message: `Đã giải nén ${entries.length} file.` };
}

async function processXml(item: { id: string; jobId: string; companyId: string; fileId: string | null }, actorId: string | null): Promise<ItemResult> {
  const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: item.fileId! } });
  const company = await prisma.company.findUniqueOrThrow({ where: { id: item.companyId } });
  const buf = await storage().get(file.storageKey);
  let inv;
  try {
    inv = parseInvoiceXml(buf);
  } catch (e) {
    if (e instanceof InvoiceParseError) return { status: "ERROR", errorCode: e.code, message: e.message, hint: e.hint };
    return { status: "ERROR", errorCode: "PARSE_FAILED", message: `Không đọc được XML: ${(e as Error).message}`, hint: "Tải lại XML gốc." };
  }

  let direction: "SALE" | "PURCHASE";
  if (inv.seller.taxCode === company.taxCode) direction = "SALE";
  else if (inv.buyer.taxCode === company.taxCode) direction = "PURCHASE";
  else
    return {
      status: "ERROR",
      errorCode: "WRONG_COMPANY",
      message: `Hóa đơn không thuộc công ty đang chọn (MST bán: ${inv.seller.taxCode}, MST mua: ${inv.buyer.taxCode ?? "không có"}; công ty: ${company.taxCode}).`,
      hint: "Chọn đúng công ty ở thanh trên cùng rồi tải lại file này.",
    };

  const identity = { companyId: item.companyId, sellerTaxCode: inv.seller.taxCode, templateCode: inv.templateCode, series: inv.series, number: inv.number };
  const dup = await prisma.invoice.findUnique({ where: { invoice_identity: identity }, select: { id: true } });
  const label = `${inv.templateCode}${inv.series}-${inv.number}`;
  if (dup) return { status: "DUPLICATE", message: `Hóa đơn ${label} của MST ${inv.seller.taxCode} đã tồn tại.`, hint: "Không cần nhập lại. Dữ liệu cũ được giữ nguyên.", invoiceId: dup.id };

  let related: { id: string } | null = null;
  if (inv.related?.number && inv.related.series) {
    related = await prisma.invoice.findFirst({
      where: { companyId: item.companyId, sellerTaxCode: inv.seller.taxCode, series: inv.related.series, number: inv.related.number, ...(inv.related.templateCode ? { templateCode: inv.related.templateCode } : {}) },
      select: { id: true },
    });
  }

  const data: Prisma.InvoiceUncheckedCreateInput = {
    ...identity,
    direction,
    nature: inv.nature,
    standard: inv.standard,
    invoiceName: inv.invoiceName,
    issueDate: inv.issueDate,
    currency: inv.currency,
    exchangeRate: inv.exchangeRate.toString(),
    paymentMethod: inv.paymentMethod,
    taxAuthorityCode: inv.taxAuthorityCode,
    sellerName: inv.seller.name,
    sellerAddress: inv.seller.address,
    buyerName: inv.buyer.name,
    buyerFullName: inv.buyer.fullName,
    buyerTaxCode: inv.buyer.taxCode,
    buyerAddress: inv.buyer.address,
    totalBeforeTax: inv.totalBeforeTax.toString(),
    totalTax: inv.totalTax.toString(),
    totalDiscount: inv.totalDiscount.toString(),
    totalPayment: inv.totalPayment.toString(),
    totalInWords: inv.totalInWords,
    relatedTemplateCode: inv.related?.templateCode,
    relatedSeries: inv.related?.series,
    relatedNumber: inv.related?.number,
    relatedIssueDate: inv.related?.issueDate,
    relatedNote: inv.related?.note,
    relatedInvoiceId: related?.id,
    xmlFileId: file.id,
    importJobId: item.jobId,
    createdById: actorId,
    lines: {
      create: inv.lines.map((l) => ({
        companyId: item.companyId,
        lineNo: l.lineNo,
        nature: l.nature,
        itemCode: l.itemCode,
        itemName: l.itemName,
        unit: l.unit,
        quantity: l.quantity?.toString(),
        unitPrice: l.unitPrice?.toString(),
        discountRate: l.discountRate?.toString(),
        discountAmount: l.discountAmount?.toString(),
        amount: l.amount.toString(),
        taxRate: l.taxRate,
        taxAmount: l.taxAmount?.toString(),
      })),
    },
    taxSummaries: {
      create: inv.taxSummaries.map((s) => ({ companyId: item.companyId, taxRate: s.taxRate, taxableAmount: s.taxableAmount.toString(), taxAmount: s.taxAmount.toString() })),
    },
  };

  try {
    const created = await prisma.$transaction(async (tx) => {
      const c = await tx.invoice.create({ data, select: { id: true } });
      const newStatus = inv.nature === "REPLACEMENT" ? "REPLACED" : inv.nature === "ADJUSTMENT" ? "ADJUSTED" : null;
      if (related && newStatus) await tx.invoice.update({ where: { id: related.id }, data: { status: newStatus } });
      // Hóa đơn gốc nhập SAU hóa đơn thay thế/điều chỉnh → nối quan hệ ngược
      const children = await tx.invoice.findMany({
        where: { companyId: item.companyId, sellerTaxCode: inv.seller.taxCode, relatedSeries: inv.series, relatedNumber: inv.number, relatedInvoiceId: null, id: { not: c.id } },
        select: { id: true, nature: true },
      });
      for (const ch of children) await tx.invoice.update({ where: { id: ch.id }, data: { relatedInvoiceId: c.id } });
      if (children.length) {
        const st = children.some((x) => x.nature === "REPLACEMENT") ? "REPLACED" : "ADJUSTED";
        await tx.invoice.update({ where: { id: c.id }, data: { status: st } });
      }
      return c;
    });
    const warn = inv.warnings.length ? ` Lưu ý: ${inv.warnings.join(" ")}` : "";
    return { status: "SUCCESS", message: `Đã nhập hóa đơn ${direction === "SALE" ? "bán ra" : "mua vào"} ${label} (${inv.lines.length} dòng hàng).${warn}`, invoiceId: created.id };
  } catch (e) {
    if (e instanceof P.PrismaClientKnownRequestError && e.code === "P2002") {
      const d = await prisma.invoice.findUnique({ where: { invoice_identity: identity }, select: { id: true } });
      return { status: "DUPLICATE", message: `Hóa đơn ${label} đã tồn tại.`, hint: "Không cần nhập lại.", invoiceId: d?.id };
    }
    throw e;
  }
}

const baseName = (n: string) => n.replace(/\.[^./\\]+$/, "").toLowerCase();

async function processPdf(item: { id: string; jobId: string; companyId: string; fileName: string; archiveName: string | null; fileId: string | null }): Promise<ItemResult> {
  const xmlItems = await prisma.importItem.findMany({
    where: { jobId: item.jobId, kind: "XML", invoiceId: { not: null }, status: { in: ["SUCCESS", "DUPLICATE"] } },
    select: { fileName: true, archiveName: true, invoiceId: true },
  });
  const match = xmlItems.find((x) => baseName(x.fileName) === baseName(item.fileName) && x.archiveName === item.archiveName);
  if (!match?.invoiceId)
    return { status: "SKIPPED", message: "Đã lưu PDF nhưng chưa khớp với hóa đơn XML nào.", hint: "Đặt tên PDF trùng tên file XML (vd: HD001.xml + HD001.pdf) hoặc đính kèm PDF trong màn hình chi tiết hóa đơn." };
  const inv = await prisma.invoice.findFirst({ where: { id: match.invoiceId, companyId: item.companyId }, select: { id: true, pdfFileId: true } });
  if (!inv) return { status: "SKIPPED", message: "Không tìm thấy hóa đơn để gắn PDF." };
  if (inv.pdfFileId && inv.pdfFileId !== item.fileId) return { status: "DUPLICATE", message: "Hóa đơn đã có file PDF; giữ nguyên PDF cũ.", invoiceId: inv.id };
  await prisma.invoice.update({ where: { id: inv.id }, data: { pdfFileId: item.fileId } });
  return { status: "SUCCESS", message: "Đã gắn PDF vào hóa đơn.", invoiceId: inv.id };
}

/** Bước 2 (nền): xử lý từng file độc lập. Lỗi một file không ảnh hưởng file khác. */
export async function processImportJob(jobId: string) {
  const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
  await prisma.importJob.update({ where: { id: jobId }, data: { status: "PROCESSING", startedAt: job.startedAt ?? new Date(), heartbeatAt: new Date() } });
  // ZIP → XML → PDF (PDF cần XML đã nhập để ghép cặp)
  for (const kind of ["ZIP", "XML", "PDF"] as FileKind[]) {
    for (;;) {
      const batch = await prisma.importItem.findMany({ where: { jobId, status: "PENDING", kind }, orderBy: { sortOrder: "asc" }, take: 25 });
      if (batch.length === 0) break;
      for (const it of batch) {
        let r: ItemResult;
        try {
          r = kind === "ZIP" ? await expandZip(it, job.createdById) : kind === "XML" ? await processXml(it, job.createdById) : await processPdf(it);
        } catch (e) {
          console.error("[import] item failed", it.id, e);
          r = { status: "ERROR", errorCode: "INTERNAL", message: `Lỗi hệ thống khi xử lý file: ${(e as Error).message}`, hint: "Thử tải lại file. Nếu vẫn lỗi, gửi file cho bộ phận hỗ trợ." };
        }
        await prisma.importItem.update({ where: { id: it.id }, data: { ...r, processedAt: new Date() } });
        await refreshJobCounters(jobId);
      }
    }
  }
  await refreshJobCounters(jobId);
  await prisma.importJob.update({ where: { id: jobId }, data: { status: "COMPLETED", finishedAt: new Date() } });
}

/** Lấy job kế tiếp cần xử lý (an toàn khi nhiều worker chạy song song). */
export async function claimNextJob(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE import_jobs SET status = 'PROCESSING', heartbeat_at = now(), started_at = COALESCE(started_at, now())
    WHERE id = (
      SELECT id FROM import_jobs
      WHERE status = 'PENDING' OR (status = 'PROCESSING' AND heartbeat_at < now() - interval '2 minutes')
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING id`;
  return rows[0]?.id ?? null;
}

export async function runPendingJobs(max = 100) {
  let n = 0;
  for (; n < max; n++) {
    const id = await claimNextJob();
    if (!id) break;
    try {
      await processImportJob(id);
    } catch (e) {
      console.error("[import] job failed", id, e);
      await prisma.importJob.update({ where: { id }, data: { status: "FAILED", finishedAt: new Date(), note: (e as Error).message } });
    }
  }
  return n;
}

export async function getImportJob(actor: Actor, companyId: string, jobId: string) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  const job = await prisma.importJob.findFirst({
    where: { id: jobId, companyId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!job) throw Errors.notFound("Lượt nhập");
  return job;
}

export async function listImportJobs(actor: Actor, companyId: string, take = 50) {
  await requireCompanyRole(actor, companyId, "VIEWER");
  return prisma.importJob.findMany({ where: { companyId }, orderBy: { createdAt: "desc" }, take });
}

export async function attachPdf(actor: Actor, companyId: string, invoiceId: string, file: UploadFile) {
  await requireCompanyRole(actor, companyId, "EDITOR");
  const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!inv) throw Errors.notFound("Hóa đơn");
  if (detectKind(file.name, file.data) !== "PDF") throw Errors.validation("File đính kèm không phải PDF.", "Chọn file .pdf bản thể hiện hóa đơn.");
  if (inv.pdfFileId) throw Errors.conflict("Hóa đơn đã có PDF.", "File gốc được lưu bất biến, không thể thay thế.");
  const stored = await storeFile(companyId, actor.id, file.name, file.data, "PDF");
  await prisma.invoice.update({ where: { id: inv.id }, data: { pdfFileId: stored.id } });
  await audit(actor, "invoice.attach_pdf", { companyId, entityType: "invoice", entityId: inv.id });
  return stored;
}
