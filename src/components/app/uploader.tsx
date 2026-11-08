"use client";
import { useRef, useState } from "react";
import { FileArchive, FileCode2, FileText, UploadCloud, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, type ApiErrorShape } from "@/components/ui/alert";
import { JobProgress } from "./job-progress";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api-client";

const ACCEPT = [".xml", ".pdf", ".zip"];
const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Uploader({ companyId, companyName, disabledReason }: { companyId: string; companyName: string; disabledReason?: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [err, setErr] = useState<ApiErrorShape | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | File[]) {
    const arr = Array.from(list);
    const bad = arr.filter((f) => !ACCEPT.some((e) => f.name.toLowerCase().endsWith(e)));
    if (bad.length) setErr({ message: `${bad.length} file không đúng định dạng đã bị bỏ qua: ${bad.slice(0, 3).map((b) => b.name).join(", ")}${bad.length > 3 ? "…" : ""}`, hint: "Chỉ chấp nhận .xml, .pdf, .zip." });
    else setErr(null);
    const ok = arr.filter((f) => !bad.includes(f));
    setFiles((cur) => {
      const keys = new Set(cur.map((f) => f.name + f.size));
      return [...cur, ...ok.filter((f) => !keys.has(f.name + f.size))];
    });
  }

  async function upload() {
    if (!files.length) return;
    setErr(null);
    setJobId(null);
    const CHUNK = 3 * 1024 * 1024; // dưới giới hạn 4,5MB/request của Vercel
    const total = files.reduce((a, f) => a + f.size, 0) || 1;
    let sent = 0;
    setUploadPct(0);
    const post = async (url: string, init: RequestInit) => {
      for (let attempt = 1; ; attempt++) {
        try {
          return await api<{ job?: { id: string } }>(url, init);
        } catch (e) {
          if (attempt >= 3 || (e instanceof ApiError && e.status > 0 && e.status < 500)) throw e;
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    };
    try {
      const created = await post(`/api/imports?companyId=${companyId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const id = created.job!.id;
      for (const f of files) {
        const parts = Math.max(1, Math.ceil(f.size / CHUNK));
        const uploadId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        for (let i = 0; i < parts; i++) {
          const blob = f.slice(i * CHUNK, Math.min(f.size, (i + 1) * CHUNK));
          const qs = new URLSearchParams({ companyId, uploadId, index: String(i), total: String(parts), name: f.name });
          await post(`/api/imports/${id}/chunk?${qs}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: blob });
          sent += blob.size;
          setUploadPct(Math.round((sent / total) * 100));
        }
      }
      await post(`/api/imports/${id}/commit?companyId=${companyId}`, { method: "POST" });
      setJobId(id);
      setFiles([]);
    } catch (e) {
      setErr(e instanceof ApiError ? e.info : { message: "Tải lên thất bại.", hint: "Kiểm tra mạng rồi thử lại." });
    } finally {
      setUploadPct(null);
    }
  }

  const Icon = (n: string) => (n.toLowerCase().endsWith(".zip") ? FileArchive : n.toLowerCase().endsWith(".pdf") ? FileText : FileCode2);
  const busy = uploadPct !== null;

  if (disabledReason) return <Alert title={disabledReason} hint="Quản trị công ty có thể cấp quyền Editor cho bạn hoặc kích hoạt lại công ty." />;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        data-testid="dropzone"
        className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-primary bg-accent" : "border-input hover:border-primary/60 hover:bg-accent/40")}
      >
        <div className="rounded-full bg-primary/10 p-3 text-primary"><UploadCloud className="h-7 w-7" /></div>
        <p className="font-medium">Kéo thả file XML / PDF / ZIP vào đây</p>
        <p className="text-sm text-muted-foreground">hoặc bấm để chọn file · Nhập vào: <b>{companyName}</b> · Tối đa 50MB/file</p>
        <input ref={inputRef} type="file" multiple accept={ACCEPT.join(",")} className="hidden" data-testid="file-input" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ""; }} />
      </div>
      {err && <Alert title={err.message} hint={err.hint} />}
      {files.length > 0 && (
        <div className="rounded-md border">
          <div className="flex items-center justify-between border-b px-4 py-2.5 text-sm">
            <span className="font-medium">Đã chọn {files.length} file · {fmtSize(files.reduce((a, f) => a + f.size, 0))}</span>
            <button className="text-muted-foreground hover:text-foreground" onClick={() => setFiles([])} disabled={busy}>Bỏ chọn tất cả</button>
          </div>
          <ul className="max-h-56 divide-y overflow-auto">
            {files.map((f, idx) => {
              const I = Icon(f.name);
              return (
                <li key={f.name + f.size} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <I className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{fmtSize(f.size)}</span>
                  <button aria-label="Bỏ file" disabled={busy} onClick={() => setFiles((x) => x.filter((_, i) => i !== idx))}><X className="h-4 w-4 text-muted-foreground" /></button>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-3 border-t px-4 py-3">
            {busy && (
              <div className="flex-1">
                <p className="mb-1 text-xs text-muted-foreground">Đang tải lên… {uploadPct}%</p>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} /></div>
              </div>
            )}
            <Button className="ml-auto" onClick={upload} disabled={busy} data-testid="upload-btn">
              {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />} Tải lên & xử lý
            </Button>
          </div>
        </div>
      )}
      {jobId && (
        <div className="rounded-md border p-4">
          <JobProgress key={jobId} jobId={jobId} companyId={companyId} />
        </div>
      )}
    </div>
  );
}
