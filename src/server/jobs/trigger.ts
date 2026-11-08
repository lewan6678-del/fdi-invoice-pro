import { after } from "next/server";
import { runPendingJobs } from "../services/imports";

const g = globalThis as unknown as { __jobRunning?: boolean; __jobAgain?: boolean };

async function drain() {
  if (g.__jobRunning) {
    g.__jobAgain = true;
    return;
  }
  g.__jobRunning = true;
  try {
    do {
      g.__jobAgain = false;
      await runPendingJobs(20);
    } while (g.__jobAgain);
  } catch (e) {
    console.error("[jobs] runner error", e);
  } finally {
    g.__jobRunning = false;
  }
}

/**
 * JOB_MODE=inline: xử lý hàng đợi sau khi trả phản hồi.
 * Dùng after() của Next.js → trên Vercel hàm serverless được giữ sống tới khi xử lý xong (waitUntil).
 * Nếu bị ngắt giữa chừng, job được nhận lại sau 2 phút (heartbeat) ở lần gọi kế tiếp.
 */
export function kickJobs() {
  if (process.env.JOB_MODE === "worker") return;
  try {
    after(drain);
  } catch {
    setImmediate(drain); // ngoài request context
  }
}
