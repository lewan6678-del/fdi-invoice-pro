import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Lưu trữ đối tượng RIÊNG TƯ cho XML/PDF.
 * - local: thư mục ngoài /public, chỉ đọc qua API có kiểm tra quyền.
 * - s3: S3 / Cloudflare R2 / MinIO (bucket private).
 * File được ghi một lần (write-once). Không có hàm ghi đè.
 */
export interface StorageDriver {
  putIfAbsent(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

class LocalStorage implements StorageDriver {
  constructor(private root: string) {}
  private p(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Khóa lưu trữ không hợp lệ");
    return full;
  }
  async putIfAbsent(key: string, data: Buffer) {
    const full = this.p(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    try {
      await fs.writeFile(full, data, { flag: "wx", mode: 0o440 }); // wx: lỗi nếu đã tồn tại → bất biến
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }
  async get(key: string) {
    return fs.readFile(this.p(key));
  }
}

class S3Storage implements StorageDriver {
  private clientPromise: Promise<import("@aws-sdk/client-s3").S3Client>;
  constructor(private bucket: string) {
    this.clientPromise = import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region: process.env.S3_REGION || "auto",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: !!process.env.S3_ENDPOINT,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
          },
        }),
    );
  }
  async putIfAbsent(key: string, data: Buffer, contentType: string) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.clientPromise;
    try {
      await c.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType, IfNoneMatch: "*" }));
    } catch (e) {
      const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 412) throw e; // 412 = đã tồn tại
    }
  }
  async get(key: string) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const c = await this.clientPromise;
    const r = await c.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (driver) return driver;
  if (process.env.STORAGE_DRIVER === "s3") {
    if (!process.env.S3_BUCKET) throw new Error("Thiếu cấu hình S3_BUCKET");
    driver = new S3Storage(process.env.S3_BUCKET);
  } else {
    driver = new LocalStorage(path.resolve(process.env.STORAGE_LOCAL_DIR || "./storage-data"));
  }
  return driver;
}

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Khóa nội dung theo công ty + hash: cùng nội dung → cùng khóa, không bao giờ ghi đè. */
export function storageKeyFor(companyId: string, hash: string, ext: string) {
  return `companies/${companyId}/${hash.slice(0, 2)}/${hash}${ext}`;
}
