import { describe, expect, it } from "vitest";
import { storage, sha256, storageKeyFor } from "@/server/storage";

describe(`Lưu trữ riêng tư (driver: ${process.env.STORAGE_DRIVER ?? "local"})`, () => {
  it("ghi một lần, đọc lại đúng từng byte, ghi lại không thay đổi nội dung", async () => {
    const data = Buffer.from("<HDon>dữ liệu mẫu</HDon>");
    const key = storageKeyFor("test-company", sha256(data), ".xml");
    await storage().putIfAbsent(key, data, "application/xml");
    await storage().putIfAbsent(key, Buffer.from("NỘI DUNG KHÁC"), "application/xml");
    expect((await storage().get(key)).equals(data)).toBe(true);
  });
});
