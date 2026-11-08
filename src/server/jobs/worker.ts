/** Worker nền độc lập: `npm run worker` (dùng khi JOB_MODE=worker hoặc khi chạy nhiều máy chủ). */
import { runPendingJobs } from "../services/imports";

async function main() {
  console.log("[worker] FDI import worker đã khởi động");
  for (;;) {
    const n = await runPendingJobs();
    if (n === 0) await new Promise((r) => setTimeout(r, 2000));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
