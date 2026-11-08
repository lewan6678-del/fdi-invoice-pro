import { runPendingJobs } from "../services/imports";

const g = globalThis as unknown as { __jobRunning?: boolean; __jobAgain?: boolean };

/** JOB_MODE=inline: chạy hàng đợi trong tiến trình web (không chặn request). */
export function kickJobs() {
  if (process.env.JOB_MODE === "worker") return; // worker riêng sẽ xử lý
  if (g.__jobRunning) {
    g.__jobAgain = true;
    return;
  }
  g.__jobRunning = true;
  setImmediate(async () => {
    try {
      do {
        g.__jobAgain = false;
        await runPendingJobs();
      } while (g.__jobAgain);
    } catch (e) {
      console.error("[jobs] runner error", e);
    } finally {
      g.__jobRunning = false;
    }
  });
}
