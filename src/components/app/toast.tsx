"use client";
import * as React from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type Toast = { id: number; tone: "success" | "error"; title: string; hint?: string };
const Ctx = React.createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => React.useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const push = React.useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.tone === "error" ? 9000 : 4000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className={`pointer-events-auto flex gap-3 rounded-lg border bg-card p-3.5 text-sm shadow-lg ${t.tone === "error" ? "border-red-300 dark:border-red-500/40" : "border-emerald-300 dark:border-emerald-500/40"}`}>
            {t.tone === "error" ? <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}
            <div className="flex-1">
              <p className="font-medium">{t.title}</p>
              {t.hint && <p className="mt-0.5 text-muted-foreground">Cách khắc phục: {t.hint}</p>}
            </div>
            <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} aria-label="Đóng thông báo" className="text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
